import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatutDevis, StatutSejour, AppelOffreStatut, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';

@Injectable()
export class DevisService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private storage: StorageService,
  ) {}

  async create(dto: CreateDevisDto, userId: string, file?: Express.Multer.File) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    // TODO: ABONNEMENT — réactiver la vérification d'abonnement

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: dto.demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'OUVERTE') {
      throw new ForbiddenException('Cette demande n\'est plus ouverte');
    }

    // Vérifier la date butoire
    if (demande.dateButoireReponse && demande.dateButoireReponse < new Date()) {
      throw new ForbiddenException('La date butoire de réponse est dépassée');
    }

    // Auto-generate numero devis if not provided
    const numeroDevis = dto.numeroDevis ?? await this.generateNumeroDevis(centre.id);

    // Save uploaded PDF file if present
    let documentUrl: string | null = null;
    if (file && file.mimetype === 'application/pdf') {
      documentUrl = await this.storage.upload(file, 'devis');
    }

    const devis = await this.prisma.devis.create({
      data: {
        demandeId: dto.demandeId,
        centreId: centre.id,
        montantTotal: dto.montantTotal,
        montantParEleve: dto.montantParEleve,
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
        documentUrl,
        // Professional fields
        nomEntreprise: dto.nomEntreprise,
        adresseEntreprise: dto.adresseEntreprise,
        siretEntreprise: dto.siretEntreprise,
        emailEntreprise: dto.emailEntreprise,
        telEntreprise: dto.telEntreprise,
        tauxTva: dto.tauxTva,
        montantHT: dto.montantHT,
        montantTVA: dto.montantTVA,
        montantTTC: dto.montantTTC,
        pourcentageAcompte: dto.pourcentageAcompte,
        montantAcompte: dto.montantAcompte,
        numeroDevis,
        typeDevis: dto.typeDevis ?? 'PLATEFORME',
      },
    });

    // Create lignes if provided
    if (dto.lignes && dto.lignes.length > 0) {
      await this.prisma.ligneDevis.createMany({
        data: dto.lignes.map((l) => ({
          devisId: devis.id,
          description: l.description,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? 0,
          totalHT: l.totalHT,
          totalTTC: l.totalTTC,
        })),
      });
    }

    const fullDevis = await this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });

    // Notifier l'enseignant du nouveau devis
    const enseignant = await this.prisma.user.findUnique({
      where: { id: demande.enseignantId! },
      select: { email: true, prenom: true, nom: true },
    });
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: demande.sejourId },
      select: { titre: true },
    });
    if (enseignant && sejour) {
      await this.email.sendDevisRecu(
        enseignant.email,
        `${enseignant.prenom} ${enseignant.nom}`,
        sejour.titre,
        centre.nom,
        String(dto.montantTotal),
      );
    }

    return fullDevis;
  }

  async getMesDevis(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    return this.prisma.devis.findMany({
      where: { centreId: centre.id },
      include: {
        lignes: true,
        centre: {
          select: {
            id: true, nom: true, ville: true, adresse: true, codePostal: true,
            siret: true, telephone: true, email: true, capacite: true,
            tvaIntracommunautaire: true, iban: true, conditionsAnnulation: true,
          },
        },
        demande: {
          include: {
            enseignant: {
              select: {
                prenom: true, nom: true, email: true, telephone: true,
                etablissementNom: true, etablissementVille: true,
              },
            },
            sejour: {
              select: {
                id: true, titre: true, dateDebut: true, dateFin: true, niveauClasse: true, statut: true,
                createur: {
                  select: {
                    prenom: true, nom: true,
                    etablissementNom: true, etablissementVille: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDevisById(id: string, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: {
        lignes: true,
        demande: {
          include: {
            enseignant: {
              select: {
                prenom: true, nom: true, email: true, telephone: true,
                etablissementNom: true, etablissementAdresse: true,
                etablissementVille: true, etablissementEmail: true, etablissementTelephone: true,
              },
            },
            sejour: {
              select: {
                titre: true, lieu: true, dateDebut: true, dateFin: true,
                placesTotales: true, niveauClasse: true,
              },
            },
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }

    return { devis, centre };
  }

  async updateDevis(id: string, dto: UpdateDevisDto, userId: string, file?: Express.Multer.File) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const devis = await this.prisma.devis.findUnique({
      where: { id },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }
    if (devis.statut !== 'EN_ATTENTE' && devis.statut !== 'SELECTIONNE') {
      throw new ForbiddenException('Seul un devis en attente ou sélectionné peut être modifié');
    }

    // Upload nouveau PDF si fourni
    let documentUrl = devis.documentUrl;
    if (file && file.mimetype === 'application/pdf') {
      documentUrl = await this.storage.upload(file, 'devis');
    }

    // Supprimer les anciennes lignes
    await this.prisma.ligneDevis.deleteMany({
      where: { devisId: id },
    });

    // Mettre à jour le devis
    const updated = await this.prisma.devis.update({
      where: { id },
      data: {
        montantTotal: dto.montantTotal ?? devis.montantTotal,
        montantParEleve: dto.montantParEleve ?? devis.montantParEleve,
        description: dto.description ?? devis.description,
        conditionsAnnulation: dto.conditionsAnnulation ?? devis.conditionsAnnulation,
        documentUrl,
        nomEntreprise: dto.nomEntreprise ?? devis.nomEntreprise,
        adresseEntreprise: dto.adresseEntreprise ?? devis.adresseEntreprise,
        siretEntreprise: dto.siretEntreprise ?? devis.siretEntreprise,
        emailEntreprise: dto.emailEntreprise ?? devis.emailEntreprise,
        telEntreprise: dto.telEntreprise ?? devis.telEntreprise,
        tauxTva: dto.tauxTva ?? devis.tauxTva,
        montantHT: dto.montantHT ?? devis.montantHT,
        montantTVA: dto.montantTVA ?? devis.montantTVA,
        montantTTC: dto.montantTTC ?? devis.montantTTC,
        pourcentageAcompte: dto.pourcentageAcompte ?? devis.pourcentageAcompte,
        montantAcompte: dto.montantAcompte ?? devis.montantAcompte,
        numeroDevis: dto.numeroDevis ?? devis.numeroDevis,
        typeDevis: dto.typeDevis ?? devis.typeDevis,
      },
    });

    // Recréer les nouvelles lignes
    if (dto.lignes && dto.lignes.length > 0) {
      await this.prisma.ligneDevis.createMany({
        data: dto.lignes.map((l) => ({
          devisId: id,
          description: l.description,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          tva: l.tva ?? 0,
          totalHT: l.totalHT,
          totalTTC: l.totalTTC,
        })),
      });
    }

    // Notifier l'enseignant si le devis était SELECTIONNE
    if (devis.statut === 'SELECTIONNE') {
      const demande = await this.prisma.demandeDevis.findUnique({
        where: { id: devis.demandeId },
        include: {
          enseignant: { select: { email: true, prenom: true, nom: true } },
          sejour: { select: { titre: true } },
        },
      });
      if (demande?.enseignant && demande?.sejour) {
        await this.email.sendGenericNotification(
          demande.enseignant.email,
          'Devis modifié par l\'hébergeur',
          `Bonjour ${demande.enseignant.prenom},\n\nL'hébergeur a apporté des modifications au devis pour le séjour "${demande.sejour.titre}". Connectez-vous à LIAVO pour consulter les changements.\n\nCordialement,\nL'équipe LIAVO`,
        );
      }
    }

    return this.prisma.devis.findUnique({
      where: { id },
      include: { lignes: true },
    });
  }

  async getDevisForDemande(demandeId: string, user: { id: string; role: string }) {
    if (user.role === 'TEACHER') {
      const demande = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
      });
      if (!demande || demande.enseignantId !== user.id) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        lignes: true,
        centre: {
          select: {
            id: true,
            nom: true,
            ville: true,
            adresse: true,
            codePostal: true,
            telephone: true,
            email: true,
            siret: true,
            capacite: true,
          },
        },
        demande: {
          include: {
            enseignant: {
              select: {
                prenom: true,
                nom: true,
                email: true,
                telephone: true,
                etablissementNom: true,
                etablissementAdresse: true,
                etablissementVille: true,
                etablissementUai: true,
                etablissementEmail: true,
                etablissementTelephone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatut(id: string, statut: StatutDevis, userId: string, userRole: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: { demande: true },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');

    // TEACHER can submit for validation or accept/refuse
    if (userRole === Role.TEACHER) {
      if (devis.demande.enseignantId !== userId) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    // DIRECTOR can validate or reject (SELECTIONNE / NON_RETENU)
    if (userRole === Role.DIRECTOR) {
      if (statut !== StatutDevis.SELECTIONNE && statut !== StatutDevis.NON_RETENU) {
        throw new ForbiddenException('Les directeurs peuvent uniquement sélectionner ou refuser un devis');
      }
    }

    const updated = await this.prisma.devis.update({
      where: { id },
      data: { statut },
    });

    // Workflow complet quand un devis est SELECTIONNE
    if (statut === StatutDevis.SELECTIONNE) {
      // 1. Passer tous les autres devis de la même demande en NON_RETENU
      await this.prisma.devis.updateMany({
        where: {
          demandeId: devis.demandeId,
          id: { not: id },
          statut: { not: StatutDevis.NON_RETENU },
        },
        data: { statut: StatutDevis.NON_RETENU },
      });

      // 2. Fermer la demande de devis
      await this.prisma.demandeDevis.update({
        where: { id: devis.demandeId },
        data: { statut: 'FERMEE' },
      });

      // 3. Mettre à jour le séjour : appel d'offres fermé + centre sélectionné + statut CONVENTION
      await this.prisma.sejour.update({
        where: { id: devis.demande.sejourId },
        data: {
          appelOffreStatut: AppelOffreStatut.FERME,
          hebergementSelectionneId: devis.centreId,
          statut: StatutSejour.CONVENTION,
        },
      });

      // 4. Notifier l'hébergeur que son devis est sélectionné
      const centre = await this.prisma.centreHebergement.findUnique({
        where: { id: devis.centreId },
        include: { user: { select: { email: true } } },
      });
      const sejour = await this.prisma.sejour.findUnique({
        where: { id: devis.demande.sejourId },
        select: { titre: true },
      });
      if (centre && sejour) {
        await this.email.sendDevisSelectionne(
          centre.user.email,
          centre.nom,
          sejour.titre,
        );
      }
    }

    return updated;
  }

  async signerDevis(devisId: string, user: { id: string; role: string }) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        demande: { include: { sejour: true } },
        centre: { include: { user: { select: { email: true } } } },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.statut !== 'SELECTIONNE') throw new ForbiddenException('Seul un devis sélectionné peut être signé');

    const directeur = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { prenom: true, nom: true, etablissementNom: true },
    });
    const nomSignataire = directeur ? `${directeur.prenom} ${directeur.nom}` : 'Directeur';

    const updated = await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        signatureDirecteur: `Signé électroniquement par ${nomSignataire} — ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
        nomSignataireDirecteur: nomSignataire,
      },
      include: { lignes: true },
    });

    if (devis.demande?.sejour) {
      await this.prisma.sejour.update({
        where: { id: devis.demande.sejour.id },
        data: { statut: StatutSejour.SIGNE_DIRECTION },
      });
    }

    if (devis.centre?.user?.email) {
      const sejourTitre = devis.demande?.sejour?.titre ?? 'le séjour';
      const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/venue/devis`;
      await this.email.sendGenericNotification(
        devis.centre.user.email,
        `Devis signé par la direction — ${sejourTitre}`,
        `<p>Bonjour,</p>
         <p>Le directeur de l'établissement a signé électroniquement le devis pour le séjour <strong>${sejourTitre}</strong>.</p>
         <p><strong>Signataire :</strong> ${nomSignataire}<br>
         <strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
         <p>Vous pouvez désormais émettre la facture d'acompte.</p>
         <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accéder à mes devis</a></p>`,
      );
    }

    return updated;
  }

  async getDevisAValider() {
    return this.prisma.devis.findMany({
      where: {
        statut: StatutDevis.SELECTIONNE,
        signatureDirecteur: null,
        typeDocument: 'DEVIS',
      },
      include: {
        lignes: true,
        centre: { select: { id: true, nom: true, ville: true, email: true, capacite: true } },
        demande: {
          include: {
            enseignant: { select: { prenom: true, nom: true } },
            sejour: { select: { id: true, titre: true, statut: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextNumeroDevis(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    return { numero: await this.generateNumeroDevis(centre.id) };
  }

  async getDemandeInfo(demandeId: string, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
      include: {
        enseignant: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            etablissementNom: true, etablissementAdresse: true,
            etablissementVille: true, etablissementEmail: true, etablissementTelephone: true,
          },
        },
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            placesTotales: true,
            niveauClasse: true,
          },
        },
      },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');

    return { demande, centre };
  }

  async facturerAcompte(id: string, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const devis = await this.prisma.devis.findUnique({
      where: { id },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }
    if (devis.statut !== StatutDevis.SELECTIONNE) {
      throw new ForbiddenException('Seul un devis sélectionné peut être facturé');
    }
    if (devis.typeDocument !== 'DEVIS') {
      throw new ForbiddenException('Ce devis a déjà été converti en facture');
    }

    const year = new Date().getFullYear();
    const numeroFacture = `FA-${year}-${id.substring(0, 4).toUpperCase()}`;
    const montantTTC = devis.montantTTC ?? Number(devis.montantTotal);
    const pourcentage = devis.pourcentageAcompte ?? 30;
    const montantAcompte = montantTTC * pourcentage / 100;

    return this.prisma.devis.update({
      where: { id },
      data: {
        typeDocument: 'FACTURE_ACOMPTE',
        estFacture: true,
        dateFacture: new Date(),
        numeroFacture,
        montantAcompte,
      },
      include: { lignes: true },
    });
  }

  async facturerSolde(id: string, userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: { lignes: true },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) throw new ForbiddenException('Ce devis ne vous appartient pas');
    if (devis.statut !== 'SELECTIONNE') throw new ForbiddenException('Seul un devis sélectionné peut être facturé');
    if (devis.typeDocument !== 'FACTURE_ACOMPTE') throw new ForbiddenException('La facture d\'acompte doit être générée en premier');
    if (!devis.acompteVerse) throw new ForbiddenException('L\'acompte doit être validé avant de générer la facture de solde');

    const year = new Date().getFullYear();
    const numeroFacture = `FS-${year}-${id.substring(0, 4).toUpperCase()}`;
    const montantTTC = devis.montantTTC ?? Number(devis.montantTotal);
    const montantAcompte = devis.montantAcompte ?? 0;
    const montantSolde = montantTTC - montantAcompte;

    return this.prisma.devis.update({
      where: { id },
      data: {
        typeDocument: 'FACTURE_SOLDE',
        numeroFacture,
        montantAcompte: montantSolde,
        dateFacture: new Date(),
      },
      include: { lignes: true },
    });
  }

  async getFacturesAcompte() {
    return this.prisma.devis.findMany({
      where: {
        typeDocument: 'FACTURE_ACOMPTE',
        statut: StatutDevis.SELECTIONNE,
      },
      include: {
        lignes: true,
        centre: { select: { id: true, nom: true, ville: true } },
        demande: {
          include: {
            sejour: {
              select: {
                id: true,
                titre: true,
                dateDebut: true,
                dateFin: true,
                createur: {
                  select: { prenom: true, nom: true, etablissementNom: true },
                },
              },
            },
          },
        },
      },
      orderBy: { dateFacture: 'desc' },
    });
  }

  async validerAcompte(id: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: {
        centre: { include: { user: { select: { email: true } } } },
        demande: { include: { sejour: { select: { titre: true } } } },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.typeDocument !== 'FACTURE_ACOMPTE') {
      throw new ForbiddenException('Ce document n\'est pas une facture d\'acompte');
    }
    if (devis.acompteVerse) {
      throw new ForbiddenException('L\'acompte a déjà été validé');
    }

    const updated = await this.prisma.devis.update({
      where: { id },
      data: {
        acompteVerse: true,
        dateVersementAcompte: new Date(),
      },
      include: { lignes: true, centre: { select: { nom: true } } },
    });

    // Notifier l'hébergeur
    if (devis.centre?.user?.email && devis.demande?.sejour?.titre) {
      await this.email.sendGenericNotification(
        devis.centre.user.email,
        'Acompte validé',
        `L'acompte de ${Number(devis.montantAcompte ?? 0).toFixed(2)} € pour le séjour "${devis.demande.sejour.titre}" a été validé par le directeur. Facture ${devis.numeroFacture}.`,
      );
    }

    return updated;
  }

  async getChorusXml(id: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: {
        lignes: true,
        centre: true,
        demande: {
          include: {
            sejour: {
              include: {
                createur: {
                  select: {
                    etablissementNom: true,
                    etablissementUai: true,
                    etablissementAdresse: true,
                    etablissementVille: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.typeDocument !== 'FACTURE_ACOMPTE' && devis.typeDocument !== 'FACTURE_SOLDE') {
      throw new ForbiddenException('Seule une facture d\'acompte peut être exportée');
    }

    const sejour = devis.demande?.sejour;
    const createur = sejour?.createur;
    const dateFacture = devis.dateFacture
      ? new Date(devis.dateFacture).toISOString().substring(0, 10)
      : new Date().toISOString().substring(0, 10);

    const lignesXml = devis.lignes.map((l, i) => `
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

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${this.escapeXml(devis.numeroFacture ?? '')}</cbc:ID>
  <cbc:IssueDate>${dateFacture}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${devis.typeDocument === 'FACTURE_SOLDE' ? '380' : '381'}</cbc:InvoiceTypeCode>
  <cbc:Note>${devis.typeDocument === 'FACTURE_SOLDE' ? 'Facture de solde' : 'Facture d\'acompte'} - ${this.escapeXml(sejour?.titre ?? '')}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>

  <!-- Émetteur (hébergeur) -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(devis.nomEntreprise ?? devis.centre?.nom ?? '')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(devis.adresseEntreprise ?? devis.centre?.adresse ?? '')}</cbc:StreetName>
        <cbc:CityName>${this.escapeXml(devis.centre?.ville ?? '')}</cbc:CityName>
        <cbc:PostalZone>${this.escapeXml(devis.centre?.codePostal ?? '')}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${this.escapeXml(devis.siretEntreprise ?? '')}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(devis.nomEntreprise ?? devis.centre?.nom ?? '')}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0002">${this.escapeXml(devis.siretEntreprise ?? '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Destinataire (établissement scolaire) -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${this.escapeXml(createur?.etablissementNom ?? '')}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${this.escapeXml(createur?.etablissementAdresse ?? '')}</cbc:StreetName>
        <cbc:CityName>${this.escapeXml(createur?.etablissementVille ?? '')}</cbc:CityName>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${this.escapeXml(createur?.etablissementNom ?? '')}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0009">${this.escapeXml(createur?.etablissementUai ?? '')}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Montants -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${(devis.montantTVA ?? 0).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${(devis.montantHT ?? 0).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${(devis.montantTVA ?? 0).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:Percent>${devis.tauxTva ?? 0}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${(devis.montantHT ?? 0).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${(devis.montantHT ?? 0).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${(devis.montantTTC ?? 0).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="EUR">${devis.typeDocument === 'FACTURE_SOLDE' ? ((devis.montantTTC ?? 0) - (devis.montantAcompte ?? 0)).toFixed(2) : (devis.montantAcompte ?? 0).toFixed(2)}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="EUR">${devis.typeDocument === 'FACTURE_SOLDE' ? ((devis.montantTTC ?? 0) - (devis.montantAcompte ?? 0)).toFixed(2) : (devis.montantAcompte ?? 0).toFixed(2)}</cbc:PayableAmount>
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

  private async generateNumeroDevis(centreId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.devis.count({
      where: {
        centreId,
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`),
        },
      },
    });
    return `DEV-${year}-${String(count + 1).padStart(3, '0')}`;
  }
}
