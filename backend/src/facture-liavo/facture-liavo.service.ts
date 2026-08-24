import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SequenceService } from '../sequence/sequence.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { generateFacturePdf } from '../facture/pdf/facture-pdf.generator.js';
import { PRIX_MENSUEL, PRIX_ANNUEL } from '../abonnements/abonnement.constants.js';
import { buildLiavoPdfParams } from './liavo-pdf.helper.js';

// La colonne sequence_numero.emetteur_id est de type uuid (@db.Uuid) : on ne peut pas
// y stocker la string 'LIAVO'. UUID sentinelle dédié à la séquence de facturation LIAVO
// (ne collisionne pas avec les UUID v4 aléatoires des centres / organisations).
const LIAVO_EMETTEUR_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class FactureLiavoService {
  private readonly logger = new Logger(FactureLiavoService.name);

  constructor(
    private prisma: PrismaService,
    private sequenceService: SequenceService,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {}

  async genererNumero(): Promise<string> {
    const num = await this.sequenceService.generer(LIAVO_EMETTEUR_ID, 'FACTURE_LIAVO');
    const annee = new Date().getFullYear();
    return `FL-${annee}-${String(num).padStart(3, '0')}`;
  }

  async genererDevisLiavo(
    centreId: string,
    plan: string,
    frequence: string,
    destinataire: { nom: string; adresse: string | null; siret: string | null; email: string | null },
  ): Promise<{ numero: string; pdfUrl: string }> {
    const num = await this.sequenceService.generer(LIAVO_EMETTEUR_ID, 'DEVIS_LIAVO');
    const annee = new Date().getFullYear();
    const numero = `DL-${annee}-${String(num).padStart(3, '0')}`;

    const centre = await this.prisma.centreHebergement.findUniqueOrThrow({
      where: { id: centreId },
    });

    const montantCentimes = frequence === 'ANNUEL' ? PRIX_ANNUEL[plan] : PRIX_MENSUEL[plan];
    if (!montantCentimes) throw new BadRequestException('Plan invalide');

    const frequenceLabel = frequence === 'ANNUEL' ? 'Annuel' : 'Mensuel';
    const description = `Abonnement LIAVO ${plan} — ${frequenceLabel}`;

    const now = new Date();
    const echeance = new Date(now);
    echeance.setDate(echeance.getDate() + 30);

    const pdfBuffer = await generateFacturePdf(buildLiavoPdfParams({
      typeFacture: 'DEVIS',
      numero,
      dateEmission: now.toISOString(),
      dateEcheance: echeance.toISOString(),
      montantCents: montantCentimes,
      destinataire,
      libelle: description,
      conditionsAnnulation: null,
    }));

    const pdfUrl = await this.storageService.uploadBuffer(
      pdfBuffer, `${numero}.pdf`, 'devis-liavo', 'application/pdf',
    );

    return { numero, pdfUrl };
  }

  async emettre(
    centreId: string,
    montantCentimes: number,
    plan: string,
    type: string,
    molliePaymentId: string | null,
    destinataire?: { nom: string; adresse: string | null; siret: string | null; email: string | null } | null,
    organisationId?: string | null,
    libelle?: string | null,
  ) {
    const numero = await this.genererNumero();

    const centre = await this.prisma.centreHebergement.findUniqueOrThrow({
      where: { id: centreId },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    const frequenceLabel = type === 'ANNUEL' ? 'Annuel' : 'Mensuel';
    const description = libelle ?? `Abonnement LIAVO ${plan} — ${frequenceLabel}`;

    // Destinataire résolu UNE fois — persisté en snapshot ET envoyé au PDF
    // (la régénération relira le snapshot, jamais le centre).
    const destinataireNom = destinataire?.nom ?? centre.nom;
    const destinataireAdresse = destinataire?.adresse ?? centre.adresse ?? null;
    const destinataireSiret = destinataire?.siret ?? centre.siret ?? null;
    const destinataireEmail = destinataire?.email ?? centre.user?.email ?? null;

    const now = new Date();
    // Mollie (molliePaymentId) = déjà payé → échéance = émission ;
    // facture manuelle (virement/BdC) = à régler → +30 jours.
    const echeance = new Date(now);
    if (!molliePaymentId) echeance.setDate(echeance.getDate() + 30);

    const facture = await this.prisma.factureLiavo.create({
      data: {
        centreId,
        // Rattachement au débiteur légal (Lot 2a) — fallback dérivé du centre :
        // même les appelants non migrés produisent des factures rattachées.
        organisationId: organisationId ?? centre.organisationId ?? null,
        numero,
        dateEmission: new Date(),
        montantHT: montantCentimes,
        montantTVA: 0,
        montantTTC: montantCentimes,
        description,
        planAbonnement: plan,
        typeAbonnement: type,
        molliePaymentId,
        destinataireNom,
        destinataireAdresse,
        destinataireSiret,
        destinataireEmail,
        dateEcheance: echeance,
      },
    });

    const montantEuros = montantCentimes / 100;
    const pdfBuffer = await generateFacturePdf(buildLiavoPdfParams({
      typeFacture: 'FACTURE',
      numero,
      dateEmission: now.toISOString(),
      dateEcheance: echeance.toISOString(),
      montantCents: montantCentimes,
      destinataire: {
        nom: destinataireNom,
        adresse: destinataireAdresse,
        siret: destinataireSiret,
        email: destinataireEmail,
      },
      libelle: description,
      conditionsTitre: 'Conditions de paiement',
      conditionsAnnulation: molliePaymentId
        ? 'Facture acquittée par prélèvement SEPA.'
        : 'À régler par virement bancaire sous 30 jours à réception.',
    }));

    const pdfUrl = await this.storageService.uploadBuffer(
      pdfBuffer, `${numero}.pdf`, 'factures-liavo', 'application/pdf',
    );

    await this.prisma.factureLiavo.update({
      where: { id: facture.id },
      data: { pdfUrl },
    });

    if (centre.user?.email) {
      const messageHtml = `<p>Bonjour ${centre.user.prenom},</p>
        <p>Veuillez trouver ci-jointe votre facture <strong>${numero}</strong> pour votre abonnement LIAVO (${plan} — ${frequenceLabel}).</p>
        <p>Montant : ${montantEuros.toFixed(2)} € HT</p>
        <p>Cordialement,<br/>L'équipe LIAVO</p>`;
      await this.emailService.sendFactureParEmail(
        centre.user.email,
        `Facture ${numero} — Abonnement LIAVO`,
        messageHtml,
        pdfBuffer,
        `${numero}.pdf`,
        { name: 'Liavo', email: 'contact@liavo.fr' },
      );
    }

    return { ...facture, pdfUrl };
  }

  /**
   * Régénère le PDF d'une facture LIAVO depuis la ROW seule (snapshot figé à
   * l'émission) — même filename/folder donc même URL, écrasée. Écritures :
   * pdfUrl uniquement. Aucun email, aucun write organisation, aucune mutation
   * des données de la facture.
   */
  async regenererPdf(factureLiavoId: string): Promise<{ pdfUrl: string }> {
    const facture = await this.prisma.factureLiavo.findUniqueOrThrow({
      where: { id: factureLiavoId },
    });

    if (!facture.destinataireNom) {
      throw new BadRequestException(
        'Snapshot destinataire absent — backfill requis avant régénération',
      );
    }

    // Rows legacy sans date_echeance : dériver comme à l'émission
    // (Mollie = payé → échéance = émission ; manuelle → +30 jours).
    let echeance = facture.dateEcheance;
    if (!echeance) {
      echeance = new Date(facture.dateEmission);
      if (!facture.molliePaymentId) echeance.setDate(echeance.getDate() + 30);
    }

    const pdfBuffer = await generateFacturePdf(buildLiavoPdfParams({
      typeFacture: 'FACTURE',
      numero: facture.numero,
      dateEmission: facture.dateEmission.toISOString(),
      dateEcheance: echeance.toISOString(),
      montantCents: facture.montantTTC,
      destinataire: {
        nom: facture.destinataireNom,
        adresse: facture.destinataireAdresse,
        siret: facture.destinataireSiret,
        email: facture.destinataireEmail,
      },
      libelle: facture.description,
      conditionsTitre: 'Conditions de paiement',
      conditionsAnnulation: facture.molliePaymentId
        ? 'Facture acquittée par prélèvement SEPA.'
        : 'À régler par virement bancaire sous 30 jours à réception.',
    }));

    const pdfUrl = await this.storageService.uploadBuffer(
      pdfBuffer, `${facture.numero}.pdf`, 'factures-liavo', 'application/pdf',
    );

    await this.prisma.factureLiavo.update({
      where: { id: facture.id },
      data: { pdfUrl },
    });

    return { pdfUrl };
  }

  async lister(centreId: string) {
    return this.prisma.factureLiavo.findMany({
      where: { centreId },
      orderBy: { dateEmission: 'desc' },
    });
  }

  /** Factures de l'organisation (Lot 2a) — toutes les nouvelles factures portent organisationId. */
  async listerParOrganisation(organisationId: string) {
    return this.prisma.factureLiavo.findMany({
      where: { organisationId },
      orderBy: { dateEmission: 'desc' },
    });
  }

  async listerToutes() {
    return this.prisma.factureLiavo.findMany({
      orderBy: { dateEmission: 'desc' },
      include: { centre: { select: { nom: true } } },
    });
  }
}
