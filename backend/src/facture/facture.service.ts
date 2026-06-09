import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatutDevis, MethodePaiement, type Facture, type LigneFacture, type VersementPaiement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { StorageService } from '../storage/storage.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';

/** Ligne d'un avoir (Lot 3). Quantités/totaux NÉGATIFS, prixUnitaire positif. */
interface LigneAvoirDto {
  description: string;
  quantite: number;       // NÉGATIF — ex. -2
  prixUnitaire: number;   // positif
  tva: number;
  totalHT: number;        // NÉGATIF
  totalTTC: number;       // NÉGATIF
}

/**
 * Module facturation (Lot 1). La Facture est un snapshot IMMUABLE émis depuis un Devis :
 * émetteur, destinataire et montants sont figés au moment de l'émission.
 * Le Devis n'est PAS muté (statut/typeDocument inchangés) — il reste modifiable, et la
 * facture de solde se calcule sur son total révisé moins l'acompte déjà facturé.
 */
@Injectable()
export class FactureService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private sequence: SequenceService,
    private storage: StorageService,
  ) {}

  // ── Génération PDF (Lot 2) ─────────────────────────────────────────────────

  /**
   * Génère le PDF d'une facture et le stocke sur OVH, puis renseigne pdfUrl.
   * NON BLOQUANT : toute erreur est loggée et la méthode retourne null —
   * l'émission de la facture ne doit jamais échouer à cause du PDF.
   */
  private async generateAndStorePdf(
    facture: Facture & {
      lignes: LigneFacture[];
      versements?: VersementPaiement[];
      factureAnnulee?: { numero: string; dateEmission: Date } | null;
    },
    titreSejour: string,
  ): Promise<string | null> {
    try {
      const { mapFactureToPdfProps } = await import('./pdf/facture-pdf.mapper.js');
      const { generateFacturePdf } = await import('./pdf/facture-pdf.generator.js');
      const props = mapFactureToPdfProps(facture, titreSejour);
      const buffer = await generateFacturePdf(props);
      // Lot 4A : embedding Factur-X (PDF/A-3 + CII XML). Import dynamique.
      // embedFacturX est non bloquant : retourne le buffer original en cas d'échec.
      const { embedFacturX } = await import('./facture-x.js');
      const facturXBuffer = await embedFacturX(buffer, facture, titreSejour);
      const filename = `${facture.numero}.pdf`;
      const url = await this.storage.uploadBuffer(facturXBuffer, filename, 'factures', 'application/pdf');
      await this.prisma.facture.update({
        where: { id: facture.id },
        data: { pdfUrl: url },
      });
      return url;
    } catch (e) {
      console.error('generateAndStorePdf error:', e instanceof Error ? e.stack : String(e));
      return null;
    }
  }

  /** Régénère le PDF d'une facture (cas où la génération initiale a échoué). */
  async regenererPdf(
    factureId: string,
    userId: string,
    centreId?: string | null,
  ): Promise<{ pdfUrl: string | null }> {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: {
        lignes: true,
        versements: { orderBy: { datePaiement: 'asc' } },
        factureAnnulee: { select: { numero: true, dateEmission: true } },
        devis: {
          include: {
            demande: { include: { sejour: { select: { titre: true } } } },
            sejourDirect: { select: { titre: true } },
          },
        },
      },
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.devis.centreId !== centre.id) throw new ForbiddenException('Accès refusé');
    if (facture.pdfUrl) {
      throw new ForbiddenException(
        'Cette facture possède déjà un PDF. La régénération n\'est autorisée que si la génération initiale a échoué.',
      );
    }
    const titreSejour =
      facture.devis.demande?.sejour?.titre ?? facture.devis.sejourDirect?.titre ?? 'Non renseigné';
    const pdfUrl = await this.generateAndStorePdf(facture, titreSejour);
    return { pdfUrl };
  }

  /** Facture brute par id (utilisé par la route de téléchargement PDF). */
  async getFactureById(factureId: string) {
    return this.prisma.facture.findUnique({ where: { id: factureId } });
  }

  // ── Helpers internes ──────────────────────────────────────────────────────

  private async chargerDevisProprietaire(devisId: string, centreId: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: true,
        centre: true,
        demande: {
          include: {
            enseignant: { select: { id: true, prenom: true, nom: true, email: true } },
            sejour: { select: { id: true, titre: true, createurId: true } },
          },
        },
        sejourDirect: {
          select: {
            id: true, titre: true, clientNom: true, clientPrenom: true,
            clientEmail: true, clientOrganisation: true,
            clientAdresse: true, clientCodePostal: true, clientVille: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centreId) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }
    return devis;
  }

  /** Snapshot émetteur : devis pro > organisation légale > centre. */
  private async construireEmetteur(devis: Awaited<ReturnType<FactureService['chargerDevisProprietaire']>>) {
    const centre = devis.centre;
    const emetteurId = centre.organisationId ?? centre.id;
    const orga = centre.organisationId
      ? await this.prisma.organisation.findUnique({ where: { id: centre.organisationId } })
      : null;

    // Sérialisation structurée "adresse||codePostal||ville" pour le CII Factur-X
    // (parseAdresse() côté facture-x.ts / formatAdressePdf() côté mapper).
    const adresseCentre = (centre.adresse && centre.codePostal && centre.ville)
      ? `${centre.adresse}||${centre.codePostal}||${centre.ville}`
      : [centre.adresse, centre.codePostal, centre.ville].filter(Boolean).join(', ');
    const adresseOrga = orga
      ? (orga.adresse && orga.codePostal && orga.ville)
        ? `${orga.adresse}||${orga.codePostal}||${orga.ville}`
        : [orga.adresse, orga.codePostal, orga.ville].filter(Boolean).join(', ')
      : '';

    return {
      emetteurId,
      emetteurNom: devis.nomEntreprise ?? orga?.raisonSociale ?? orga?.nom ?? centre.nom,
      emetteurAdresse: devis.adresseEntreprise ?? (adresseCentre || adresseOrga || null),
      emetteurSiret: devis.siretEntreprise ?? orga?.siret ?? centre.siret ?? null,
      emetteurTva: centre.tvaIntracommunautaire ?? null,
      emetteurEmail: devis.emailEntreprise ?? centre.email ?? null,
      emetteurTel: devis.telEntreprise ?? centre.telephone ?? null,
      emetteurIban: centre.iban ?? null,
    };
  }

  /** Snapshot destinataire : collab → organisation du créateur du séjour + email enseignant ;
   *  direct → client du séjour. */
  private async construireDestinataire(devis: Awaited<ReturnType<FactureService['chargerDevisProprietaire']>>) {
    // ── Devis complémentaire : destinataire PROPRE (priorité absolue) ──
    if (devis.isComplementaire && devis.destinataireNom) {
      const adresseSerializee = (devis.destinataireAdresse && devis.destinataireCodePostal && devis.destinataireVille)
        ? `${devis.destinataireAdresse}||${devis.destinataireCodePostal}||${devis.destinataireVille}`
        : [devis.destinataireAdresse, devis.destinataireCodePostal, devis.destinataireVille].filter(Boolean).join(', ') || null;
      return {
        sejourId: devis.sejourDirectId ?? null,
        destinataireNom: devis.destinataireNom,
        destinataireAdresse: adresseSerializee,
        destinataireSiret: devis.destinataireSiret ?? null,
        destinataireEmail: devis.destinataireEmail ?? null,
        emailNotif: devis.destinataireEmail ?? null,
        sejourTitre: devis.sejourDirect?.titre ?? 'votre séjour',
      };
    }

    if (devis.demandeId && devis.demande) {
      const enseignant = devis.demande.enseignant;
      const createurId = devis.demande.sejour?.createurId ?? null;
      const orga = createurId ? await getOrganisationPrincipale(createurId, this.prisma) : null;
      // Sérialisation structurée "adresse||codePostal||ville" pour le CII Factur-X.
      const adresseOrga = orga
        ? (orga.adresse && orga.codePostal && orga.ville)
          ? `${orga.adresse}||${orga.codePostal}||${orga.ville}`
          : [orga.adresse, orga.codePostal, orga.ville].filter(Boolean).join(', ')
        : '';
      return {
        sejourId: devis.demande.sejour?.id ?? null,
        destinataireNom: orga?.nom ?? (enseignant ? `${enseignant.prenom} ${enseignant.nom}` : ''),
        destinataireAdresse: adresseOrga || null,
        destinataireSiret: orga?.siret ?? null,
        destinataireEmail: enseignant?.email ?? null,
        emailNotif: enseignant?.email ?? null,
        sejourTitre: devis.demande.sejour?.titre ?? 'votre séjour',
      };
    }
    // Devis direct
    const sejour = devis.sejourDirect;
    const nomClient = [sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' ');
    const adresseClient =
      [
        sejour?.clientAdresse,
        [sejour?.clientCodePostal, sejour?.clientVille].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ') || null;
    return {
      sejourId: devis.sejourDirectId ?? null,
      destinataireNom: sejour?.clientOrganisation ?? nomClient ?? '',
      destinataireAdresse: adresseClient,
      destinataireSiret: null,
      destinataireEmail: sejour?.clientEmail ?? null,
      emailNotif: sejour?.clientEmail ?? null,
      sejourTitre: sejour?.titre ?? 'votre séjour',
    };
  }

  /** Log CRM inline (pattern identique à DevisService.envoyerDevisDirect). Non bloquant. */
  private async loggerActivite(sejourId: string | null, centreId: string, description: string, metadata: object) {
    if (!sejourId) return;
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId,
            type: 'FACTURE',
            description,
            metadata,
          },
        });
      }
    } catch { /* non bloquant */ }
  }

  // ── Émission ──────────────────────────────────────────────────────────────

  /** Émet la facture d'acompte (devis collab OU direct — détection automatique). NE MUTE PAS le devis. */
  async emettreAcompte(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const devis = await this.chargerDevisProprietaire(devisId, centre.id);

    if (devis.isComplementaire) {
      // Un devis complémentaire peut être facturé dès sa création (pas de signature)
      if (devis.statut === StatutDevis.NON_RETENU) {
        throw new ForbiddenException('Ce devis a été annulé et ne peut plus être facturé');
      }
    } else {
      if (devis.statut !== StatutDevis.SELECTIONNE && devis.statut !== StatutDevis.SIGNE_DIRECTION) {
        throw new ForbiddenException('Seul un devis sélectionné ou signé peut être facturé');
      }
    }
    const acompteExistant = await this.prisma.facture.findFirst({
      where: { devisId, typeFacture: 'ACOMPTE' },
    });
    if (acompteExistant) {
      throw new ForbiddenException('La facture d\'acompte a déjà été émise pour ce devis');
    }

    const emetteur = await this.construireEmetteur(devis);
    const destinataire = await this.construireDestinataire(devis);

    const annee = new Date().getFullYear();
    const numero = `FA-${annee}-${String(await this.sequence.generer(emetteur.emetteurId, 'FACTURE')).padStart(4, '0')}`;

    const montantTTC = devis.montantTTC ?? Number(devis.montantTotal);
    const pourcentage = devis.pourcentageAcompte ?? 30;
    const montantFacture = devis.montantAcompte ?? (montantTTC * pourcentage / 100);

    const facture = await this.prisma.facture.create({
      data: {
        devisId,
        sejourId: destinataire.sejourId,
        emetteurId: emetteur.emetteurId,
        numero,
        typeFacture: 'ACOMPTE',
        dateEmission: new Date(),
        emetteurNom: emetteur.emetteurNom,
        emetteurAdresse: emetteur.emetteurAdresse,
        emetteurSiret: emetteur.emetteurSiret,
        emetteurTva: emetteur.emetteurTva,
        emetteurEmail: emetteur.emetteurEmail,
        emetteurTel: emetteur.emetteurTel,
        emetteurIban: emetteur.emetteurIban,
        destinataireNom: destinataire.destinataireNom,
        destinataireAdresse: destinataire.destinataireAdresse,
        destinataireSiret: destinataire.destinataireSiret,
        destinataireEmail: destinataire.destinataireEmail,
        montantHT: devis.montantHT ?? 0,
        montantTVA: devis.montantTVA ?? 0,
        montantTTC,
        tauxTva: devis.tauxTva ?? 0,
        montantFacture,
        pourcentageAcompte: pourcentage,
        conditionsAnnulation: devis.conditionsAnnulation,
        lignes: {
          create: devis.lignes.map((l) => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            totalHT: l.totalHT,
            totalTTC: l.totalTTC,
          })),
        },
      },
      include: { lignes: true, versements: true },
    });

    // Génération PDF + stockage OVH (fire-and-forget — non bloquant sur la réponse HTTP)
    void this.generateAndStorePdf(facture, destinataire.sejourTitre);

    await this.loggerActivite(
      destinataire.sejourId,
      centre.id,
      `Facture d'acompte ${numero} émise — ${montantFacture.toFixed(2)} €`,
      { factureId: facture.id, devisId, type: 'ACOMPTE' },
    );

    // Notification destinataire (non bloquant)
    try {
      if (destinataire.emailNotif) {
        const montantFormate = montantFacture.toFixed(2).replace('.', ',');
        await this.email.sendGenericNotification(
          destinataire.emailNotif,
          `Facture d'acompte émise — ${destinataire.sejourTitre}`,
          `L'hébergeur a émis une facture d'acompte (${numero}) d'un montant de ${montantFormate} € pour « ${destinataire.sejourTitre} ».`,
        );
      }
    } catch { /* non bloquant */ }

    return facture;
  }

  /** Émet la facture de solde sur le total RÉVISÉ du devis moins l'acompte déjà facturé. NE MUTE PAS le devis. */
  async emettreFactureSolde(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const devis = await this.chargerDevisProprietaire(devisId, centre.id);

    const factureAcompte = await this.prisma.facture.findFirst({
      where: { devisId, typeFacture: 'ACOMPTE' },
    });
    if (!factureAcompte) {
      throw new ForbiddenException('La facture d\'acompte doit être émise en premier');
    }
    if (!factureAcompte.acompteVerse) {
      throw new ForbiddenException('L\'acompte doit être validé avant d\'émettre la facture de solde');
    }
    const soldeExistant = await this.prisma.facture.findFirst({
      where: { devisId, typeFacture: 'SOLDE' },
    });
    if (soldeExistant) {
      throw new ForbiddenException('La facture de solde a déjà été émise pour ce devis');
    }

    const montantTTC = devis.montantTTC ?? Number(devis.montantTotal);
    const acompte = factureAcompte.montantFacture;
    let acompteNet = acompte;
    if (montantTTC <= acompte) {
      // Chercher un avoir sur la facture d'acompte (relation 1-1 via factureAnnuleeId)
      const avoir = await this.prisma.facture.findUnique({
        where: { factureAnnuleeId: factureAcompte.id },
      });
      if (!avoir) {
        throw new ForbiddenException(
          'Le total révisé du devis est inférieur ou égal à l\'acompte déjà facturé. ' +
          'Émettez d\'abord un avoir sur la facture d\'acompte depuis l\'onglet ' +
          'Devis & Facturation.'
        );
      }
      // avoir.montantFacture est négatif (ex : -240) → réduit l'acompte net
      acompteNet = acompte + avoir.montantFacture; // ex : 1440 + (-240) = 1200
      if (acompteNet < 0) {
        throw new ForbiddenException(
          'L\'avoir dépasse le montant de l\'acompte — situation comptable incohérente.'
        );
      }
    }
    const montantFacture = Math.max(0, montantTTC - acompteNet);

    const emetteur = await this.construireEmetteur(devis);
    const destinataire = await this.construireDestinataire(devis);

    const annee = new Date().getFullYear();
    const numero = `FS-${annee}-${String(await this.sequence.generer(emetteur.emetteurId, 'FACTURE')).padStart(4, '0')}`;

    const facture = await this.prisma.facture.create({
      data: {
        devisId,
        sejourId: destinataire.sejourId,
        emetteurId: emetteur.emetteurId,
        numero,
        typeFacture: 'SOLDE',
        dateEmission: new Date(),
        emetteurNom: emetteur.emetteurNom,
        emetteurAdresse: emetteur.emetteurAdresse,
        emetteurSiret: emetteur.emetteurSiret,
        emetteurTva: emetteur.emetteurTva,
        emetteurEmail: emetteur.emetteurEmail,
        emetteurTel: emetteur.emetteurTel,
        emetteurIban: emetteur.emetteurIban,
        destinataireNom: destinataire.destinataireNom,
        destinataireAdresse: destinataire.destinataireAdresse,
        destinataireSiret: destinataire.destinataireSiret,
        destinataireEmail: destinataire.destinataireEmail,
        montantHT: devis.montantHT ?? 0,
        montantTVA: devis.montantTVA ?? 0,
        montantTTC,
        tauxTva: devis.tauxTva ?? 0,
        montantFacture,
        pourcentageAcompte: devis.pourcentageAcompte,
        factureAcompteId: factureAcompte.id,
        montantAcompteDejaFacture: acompteNet,
        conditionsAnnulation: devis.conditionsAnnulation,
        lignes: {
          create: devis.lignes.map((l) => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            totalHT: l.totalHT,
            totalTTC: l.totalTTC,
          })),
        },
      },
      include: { lignes: true, versements: true },
    });

    // Génération PDF + stockage OVH (fire-and-forget — non bloquant sur la réponse HTTP)
    void this.generateAndStorePdf(facture, destinataire.sejourTitre);

    await this.loggerActivite(
      destinataire.sejourId,
      centre.id,
      `Facture de solde ${numero} émise — ${montantFacture.toFixed(2)} €`,
      { factureId: facture.id, devisId, type: 'SOLDE' },
    );

    try {
      if (destinataire.emailNotif) {
        const montantFormate = montantFacture.toFixed(2).replace('.', ',');
        await this.email.sendGenericNotification(
          destinataire.emailNotif,
          `Facture de solde émise — ${destinataire.sejourTitre}`,
          `L'hébergeur a émis la facture de solde (${numero}) d'un montant de ${montantFormate} € pour « ${destinataire.sejourTitre} ».`,
        );
      }
    } catch { /* non bloquant */ }

    return facture;
  }

  /**
   * Émet une facture de SOLDE couvrant 100 % du devis, SANS acompte préalable
   * ("facturer le total"). Réservé aux devis signés non encore facturés. NE MUTE PAS le devis.
   * Réutilise la séquence FS-YYYY-XXXX (pas de nouvelle série) et le même pattern que
   * emettreAcompte/emettreFactureSolde.
   */
  async emettreFactureTotal(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const devis = await this.chargerDevisProprietaire(devisId, centre.id);

    // Même guard que emettreAcompte
    if (devis.isComplementaire) {
      if (devis.statut === StatutDevis.NON_RETENU) {
        throw new ForbiddenException('Ce devis a été annulé et ne peut plus être facturé');
      }
    } else {
      if (devis.statut !== StatutDevis.SELECTIONNE && devis.statut !== StatutDevis.SIGNE_DIRECTION) {
        throw new ForbiddenException('Seul un devis sélectionné ou signé peut être facturé');
      }
    }
    // Aucune facture (acompte OU solde) ne doit déjà exister
    const factureExistante = await this.prisma.facture.findFirst({
      where: { devisId, typeFacture: { in: ['ACOMPTE', 'SOLDE'] } },
    });
    if (factureExistante) {
      throw new ForbiddenException('Une facture a déjà été émise pour ce devis');
    }

    const emetteur = await this.construireEmetteur(devis);
    const destinataire = await this.construireDestinataire(devis);

    const annee = new Date().getFullYear();
    const numero = `FS-${annee}-${String(await this.sequence.generer(emetteur.emetteurId, 'FACTURE')).padStart(4, '0')}`;

    const montantTTC = devis.montantTTC ?? Number(devis.montantTotal);

    const facture = await this.prisma.facture.create({
      data: {
        devisId,
        sejourId: destinataire.sejourId,
        emetteurId: emetteur.emetteurId,
        numero,
        typeFacture: 'SOLDE',
        dateEmission: new Date(),
        emetteurNom: emetteur.emetteurNom,
        emetteurAdresse: emetteur.emetteurAdresse,
        emetteurSiret: emetteur.emetteurSiret,
        emetteurTva: emetteur.emetteurTva,
        emetteurEmail: emetteur.emetteurEmail,
        emetteurTel: emetteur.emetteurTel,
        emetteurIban: emetteur.emetteurIban,
        destinataireNom: destinataire.destinataireNom,
        destinataireAdresse: destinataire.destinataireAdresse,
        destinataireSiret: destinataire.destinataireSiret,
        destinataireEmail: destinataire.destinataireEmail,
        montantHT: devis.montantHT ?? 0,
        montantTVA: devis.montantTVA ?? 0,
        montantTTC,
        tauxTva: devis.tauxTva ?? 0,
        montantFacture: montantTTC,        // 100 % — pas d'acompte déduit
        pourcentageAcompte: null,
        factureAcompteId: null,
        montantAcompteDejaFacture: 0,
        conditionsAnnulation: devis.conditionsAnnulation,
        lignes: {
          create: devis.lignes.map((l) => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            totalHT: l.totalHT,
            totalTTC: l.totalTTC,
          })),
        },
      },
      include: { lignes: true, versements: true },
    });

    // Génération PDF + stockage OVH (fire-and-forget — non bloquant sur la réponse HTTP)
    void this.generateAndStorePdf(facture, destinataire.sejourTitre);

    await this.loggerActivite(
      destinataire.sejourId,
      centre.id,
      `Facture de solde ${numero} émise (total, sans acompte) — ${montantTTC.toFixed(2)} €`,
      { factureId: facture.id, devisId, type: 'SOLDE' },
    );

    // Même notification que emettreFactureSolde (non bloquant)
    try {
      if (destinataire.emailNotif) {
        const montantFormate = montantTTC.toFixed(2).replace('.', ',');
        await this.email.sendGenericNotification(
          destinataire.emailNotif,
          `Facture de solde émise — ${destinataire.sejourTitre}`,
          `L'hébergeur a émis la facture de solde (${numero}) d'un montant de ${montantFormate} € pour « ${destinataire.sejourTitre} ».`,
        );
      }
    } catch { /* non bloquant */ }

    return facture;
  }

  /**
   * Émet un avoir (note de crédit) sur une facture ACOMPTE ou SOLDE existante.
   * Snapshot émetteur/destinataire copié DIRECTEMENT depuis la facture annulée (déjà figé).
   * Montants stockés NÉGATIFS en base ; dto.montant est passé positif.
   */
  async emettreAvoir(
    factureAnnuleeId: string,
    dto: { montant: number; motif: string; lignes: LigneAvoirDto[] },
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Vérifie la propriété (lève si la facture n'appartient pas au centre)
    await this.chargerFactureProprietaire(factureAnnuleeId, centre.id);

    // Recharge avec lignes + contexte séjour (chargerFactureProprietaire ne renvoie pas les lignes)
    const factureAnnulee = await this.prisma.facture.findUnique({
      where: { id: factureAnnuleeId },
      include: {
        lignes: true,
        devis: {
          select: {
            id: true,
            centreId: true,
            demande: { include: { sejour: { select: { id: true, titre: true } } } },
            sejourDirect: { select: { id: true, titre: true } },
          },
        },
      },
    });
    if (!factureAnnulee) throw new NotFoundException('Facture introuvable');

    // a. Pas d'avoir sur un avoir
    if (factureAnnulee.typeFacture !== 'ACOMPTE' && factureAnnulee.typeFacture !== 'SOLDE') {
      throw new ForbiddenException('Un avoir ne peut annuler qu\'une facture d\'acompte ou de solde');
    }
    // b. Un seul avoir par facture
    const avoirExistant = await this.prisma.facture.findUnique({
      where: { factureAnnuleeId },
    });
    if (avoirExistant) {
      throw new ForbiddenException('Un avoir a déjà été émis pour cette facture');
    }
    // c. Montant strictement positif
    if (!(dto.montant > 0)) {
      throw new ForbiddenException('Le montant de l\'avoir doit être strictement positif');
    }
    // d. Montant <= montant de la facture annulée (arrondi 2 décimales)
    if (Math.round(dto.montant * 100) > Math.round(factureAnnulee.montantFacture * 100)) {
      throw new ForbiddenException('Le montant de l\'avoir dépasse le montant de la facture annulée');
    }
    // e. Cohérence des lignes (somme |totalTTC| ≈ montant, tolérance ±0,02 €)
    const sommeTTC = dto.lignes.reduce((acc, l) => acc + l.totalTTC, 0);
    if (Math.abs(Math.abs(sommeTTC) - dto.montant) > 0.02) {
      throw new ForbiddenException('Le total des lignes ne correspond pas au montant de l\'avoir');
    }

    const annee = new Date().getFullYear();
    const numero = `AV-${annee}-${String(await this.sequence.generer(factureAnnulee.emetteurId, 'AVOIR')).padStart(4, '0')}`;

    // Montants de l'avoir (négatifs)
    const montantHT = dto.lignes.reduce((acc, l) => acc + l.totalHT, 0);
    const montantTTC = dto.lignes.reduce((acc, l) => acc + l.totalTTC, 0);
    const montantTVA = montantTTC - montantHT;
    const montantFacture = -dto.montant;

    const avoir = await this.prisma.facture.create({
      data: {
        devisId: factureAnnulee.devisId,
        sejourId: factureAnnulee.sejourId,
        emetteurId: factureAnnulee.emetteurId,
        numero,
        typeFacture: 'AVOIR',
        dateEmission: new Date(),
        factureAnnuleeId,
        motifAvoir: dto.motif,
        // Snapshot copié depuis la facture annulée (déjà figé)
        emetteurNom: factureAnnulee.emetteurNom,
        emetteurAdresse: factureAnnulee.emetteurAdresse,
        emetteurSiret: factureAnnulee.emetteurSiret,
        emetteurTva: factureAnnulee.emetteurTva,
        emetteurEmail: factureAnnulee.emetteurEmail,
        emetteurTel: factureAnnulee.emetteurTel,
        emetteurIban: null, // un avoir ne génère pas de paiement entrant
        destinataireNom: factureAnnulee.destinataireNom,
        destinataireAdresse: factureAnnulee.destinataireAdresse,
        destinataireSiret: factureAnnulee.destinataireSiret,
        destinataireEmail: factureAnnulee.destinataireEmail,
        montantHT,
        montantTVA,
        montantTTC,
        tauxTva: factureAnnulee.tauxTva,
        montantFacture,
        montantVerseTotal: 0,
        acompteVerse: false,
        conditionsAnnulation: factureAnnulee.conditionsAnnulation,
        lignes: {
          create: dto.lignes.map((l) => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            tva: l.tva,
            totalHT: l.totalHT,
            totalTTC: l.totalTTC,
          })),
        },
      },
      include: {
        lignes: true,
        versements: true,
        factureAnnulee: { select: { numero: true, dateEmission: true } },
      },
    });

    const titreSejour =
      factureAnnulee.devis.demande?.sejour?.titre ??
      factureAnnulee.devis.sejourDirect?.titre ??
      'Non renseigné';

    // Génération PDF + stockage OVH (fire-and-forget — non bloquant)
    void this.generateAndStorePdf(avoir, titreSejour);

    await this.loggerActivite(
      factureAnnulee.sejourId,
      centre.id,
      `Avoir ${numero} émis — −${dto.montant.toFixed(2)} € (annule ${factureAnnulee.numero})`,
      { factureId: avoir.id, factureAnnuleeId, type: 'AVOIR' },
    );

    return avoir;
  }

  // ── Consultation ──────────────────────────────────────────────────────────

  async getFacturesForDevis(devisId: string) {
    return this.prisma.facture.findMany({
      where: { devisId },
      include: {
        lignes: true,
        versements: { orderBy: { datePaiement: 'asc' } },
        // Avoir lié (Lot 3) : permet à l'UI de signaler qu'une facture a été annulée.
        // factureAnnuleeId + motifAvoir sont des scalaires déjà renvoyés par include.
        avoirAssocie: { select: { id: true, numero: true, dateEmission: true, montantFacture: true } },
      },
      orderBy: { dateEmission: 'asc' },
    });
  }

  // ── Versements ────────────────────────────────────────────────────────────

  private async chargerFactureProprietaire(factureId: string, centreId: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { devis: { select: { id: true, centreId: true } } },
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.devis.centreId !== centreId) {
      throw new ForbiddenException('Cette facture ne vous appartient pas');
    }
    return facture;
  }

  /** Recalcule montantVerseTotal du devis = somme de TOUS ses versements (acompte + solde). */
  private async resyncMontantVerseDevis(devisId: string) {
    const agg = await this.prisma.versementPaiement.aggregate({
      where: { devisId },
      _sum: { montant: true },
    });
    await this.prisma.devis.update({
      where: { id: devisId },
      data: { montantVerseTotal: agg._sum.montant ?? 0 },
    });
  }

  async ajouterVersement(
    factureId: string,
    dto: { montant: number; datePaiement: string; reference?: string; modePaiement?: string },
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const facture = await this.chargerFactureProprietaire(factureId, centre.id);

    await this.prisma.versementPaiement.create({
      data: {
        devisId: facture.devisId,
        factureId,
        montant: dto.montant,
        datePaiement: new Date(dto.datePaiement),
        reference: dto.reference ?? null,
        modePaiement: (dto.modePaiement as MethodePaiement) ?? null,
      },
    });

    const nouveauTotal = (facture.montantVerseTotal ?? 0) + dto.montant;
    const verseComplet = nouveauTotal >= facture.montantFacture * 0.99;

    const updated = await this.prisma.facture.update({
      where: { id: factureId },
      data: {
        montantVerseTotal: nouveauTotal,
        acompteVerse: verseComplet,
        ...(verseComplet && !facture.acompteVerse ? { dateVersement: new Date() } : {}),
      },
      include: { lignes: true, versements: { orderBy: { datePaiement: 'asc' } } },
    });

    await this.resyncMontantVerseDevis(facture.devisId);
    return updated;
  }

  async supprimerVersement(factureId: string, versementId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.chargerFactureProprietaire(factureId, centre.id);

    const versement = await this.prisma.versementPaiement.findUnique({ where: { id: versementId } });
    if (!versement || versement.factureId !== factureId) {
      throw new NotFoundException('Versement introuvable');
    }
    await this.prisma.versementPaiement.delete({ where: { id: versementId } });

    const restants = await this.prisma.versementPaiement.findMany({ where: { factureId } });
    const nouveauTotal = restants.reduce((sum, v) => sum + v.montant, 0);
    const facture = await this.prisma.facture.findUnique({ where: { id: factureId } });

    const updated = await this.prisma.facture.update({
      where: { id: factureId },
      data: {
        montantVerseTotal: nouveauTotal,
        acompteVerse: nouveauTotal >= (facture?.montantFacture ?? 0) * 0.99,
      },
      include: { lignes: true, versements: { orderBy: { datePaiement: 'asc' } } },
    });

    await this.resyncMontantVerseDevis(updated.devisId);
    return updated;
  }

  /** Valide le règlement d'une facture d'acompte (SIGNATAIRE/HEBERGEUR). */
  async validerAcompte(factureId: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: {
        devis: {
          include: {
            centre: { include: { user: { select: { email: true } } } },
            demande: { include: { sejour: { select: { titre: true } } } },
            sejourDirect: { select: { titre: true } },
          },
        },
      },
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.typeFacture !== 'ACOMPTE') {
      throw new ForbiddenException('Seule une facture d\'acompte peut être validée');
    }
    if (facture.acompteVerse) {
      throw new ForbiddenException('Cet acompte a déjà été validé');
    }

    const updated = await this.prisma.facture.update({
      where: { id: factureId },
      data: { acompteVerse: true, dateVersement: new Date() },
      include: { lignes: true, versements: true },
    });

    try {
      const emailHebergeur = facture.devis.centre?.user?.email;
      const titre = facture.devis.demande?.sejour?.titre ?? facture.devis.sejourDirect?.titre ?? 'le séjour';
      if (emailHebergeur) {
        await this.email.sendGenericNotification(
          emailHebergeur,
          'Acompte validé',
          `L'acompte de ${facture.montantFacture.toFixed(2)} € pour « ${titre} » a été validé. Facture ${facture.numero}.`,
        );
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  // ── Chorus Pro (Factur-X / UBL) ────────────────────────────────────────────

  async getChorusXml(factureId: string) {
    const facture = await this.prisma.facture.findUnique({
      where: { id: factureId },
      include: { lignes: true, devis: { include: { centre: { select: { mandatFacturationAccepte: true } } } } },
    });
    if (!facture) throw new NotFoundException('Facture introuvable');
    if (facture.typeFacture === 'AVOIR') {
      throw new ForbiddenException(
        'Chorus Pro pour les avoirs (InvoiceTypeCode 381) sera implémenté au Lot 4.',
      );
    }
    if (!facture.devis.centre?.mandatFacturationAccepte) {
      throw new ForbiddenException(
        'Mandat de facturation non accepté. Veuillez l\'accepter dans vos paramètres avant de générer des factures Chorus Pro.',
      );
    }

    const dateFacture = new Date(facture.dateEmission).toISOString().substring(0, 10);
    const lignesXml = facture.lignes.map((l, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="C62">${l.quantite}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="EUR">${l.totalHT.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Name>${this.escapeXml(l.description)}</cbc:Name>
        <cac:ClassifiedTaxCategory>
          <cbc:Percent>${l.tva}</cbc:Percent>
          <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
        </cac:ClassifiedTaxCategory>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="EUR">${l.prixUnitaire.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`).join('');

    const prepaid = facture.typeFacture === 'SOLDE' ? (facture.montantAcompteDejaFacture ?? 0) : 0;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${this.escapeXml(facture.numero)}</cbc:ID>
  <cbc:IssueDate>${dateFacture}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${facture.typeFacture === 'SOLDE' ? '380' : '386'}</cbc:InvoiceTypeCode>
  <cbc:Note>${facture.typeFacture === 'SOLDE' ? 'Facture de solde' : 'Facture d\'acompte'}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>

  <!-- Émetteur (snapshot figé) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${this.escapeXml(facture.emetteurNom)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(facture.emetteurAdresse ?? '')}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${this.escapeXml(facture.emetteurTva ?? '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(facture.emetteurNom)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0002">${this.escapeXml(facture.emetteurSiret ?? '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Destinataire (snapshot figé) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${this.escapeXml(facture.destinataireNom)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(facture.destinataireAdresse ?? '')}</cbc:StreetName>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(facture.destinataireNom)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0002">${this.escapeXml(facture.destinataireSiret ?? '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Montants -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${facture.montantTVA.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${facture.montantHT.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${facture.montantTVA.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${facture.tauxTva}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${facture.montantHT.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${facture.montantHT.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${facture.montantTTC.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="EUR">${prepaid.toFixed(2)}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="EUR">${facture.montantFacture.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Lignes -->${lignesXml}
</Invoice>`;

    return { xml };
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
