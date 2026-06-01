import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { StatutDevis, StatutSejour, AppelOffreStatut, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';
import { ClientsService } from '../clients/clients.service.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { SequenceService } from '../sequence/sequence.service.js';

@Injectable()
export class DevisService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private storage: StorageService,
    private clientsService: ClientsService,
    private sequence: SequenceService,
  ) {}

  async create(dto: CreateDevisDto, userId: string, file?: Express.Multer.File, centreId?: string | null) {
    if (!dto.demandeId) {
      throw new ForbiddenException('demandeId est requis. Utilisez POST /devis/direct pour un séjour en gestion directe.');
    }
    const demandeId: string = dto.demandeId;
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    // TODO: ABONNEMENT — réactiver la vérification d'abonnement

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'OUVERTE') {
      throw new ForbiddenException('Cette demande n\'est plus ouverte');
    }

    // Vérifier la date butoire
    if (demande.dateButoireReponse && demande.dateButoireReponse < new Date()) {
      throw new ForbiddenException('La date butoire de réponse est dépassée');
    }

    // Vérifier qu'un devis actif n'existe pas déjà pour ce couple demande/centre
    const devisExistant = await this.prisma.devis.findFirst({
      where: {
        demandeId,
        centreId: centre.id,
        statut: {
          in: [
            StatutDevis.EN_ATTENTE,
            StatutDevis.EN_ATTENTE_VALIDATION,
            StatutDevis.SELECTIONNE,
          ],
        },
      },
    });
    if (devisExistant) {
      throw new ForbiddenException(
        'Vous avez déjà soumis un devis pour cette demande. Modifiez le devis existant.'
      );
    }

    // Numéro de devis séquentiel atomique par émetteur (non overridable)
    const emetteurId = centre.organisationId ?? centre.id;
    const numeroDevis = await this.formaterNumeroDevis(emetteurId);

    // Save uploaded PDF file if present
    let documentUrl: string | null = null;
    if (file && file.mimetype === 'application/pdf') {
      documentUrl = await this.storage.upload(file, 'devis');
    }

    const devis = await this.prisma.devis.create({
      data: {
        demandeId,
        centreId: centre.id,
        emetteurId,
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

  async getMesDevis(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    return this.prisma.devis.findMany({
      where: { centreId: centre.id },
      include: {
        lignes: true,
        versements: { orderBy: { datePaiement: 'asc' as const } },
        factures: {
          include: { lignes: true, versements: { orderBy: { datePaiement: 'asc' as const } } },
          orderBy: { dateEmission: 'asc' as const },
        },
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
                id: true, prenom: true, nom: true, email: true, telephone: true,
                memberships: {
                  where: { isPrimary: true },
                  select: {
                    organisation: { select: { nom: true, ville: true, uai: true } },
                  },
                  take: 1,
                },
              },
            },
            sejour: {
              select: {
                id: true, titre: true, dateDebut: true, dateFin: true, niveauClasse: true, statut: true,
                createur: {
                  select: {
                    prenom: true, nom: true,
                    memberships: {
                      where: { isPrimary: true },
                      select: {
                        organisation: { select: { nom: true, ville: true } },
                      },
                      take: 1,
                    },
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

  async getDevisById(id: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: {
        lignes: true,
        factures: {
          include: { lignes: true, versements: { orderBy: { datePaiement: 'asc' as const } } },
          orderBy: { dateEmission: 'asc' as const },
        },
        demande: {
          include: {
            enseignant: {
              select: { prenom: true, nom: true, email: true, telephone: true },
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

  async updateDevis(id: string, dto: UpdateDevisDto, userId: string, file?: Express.Multer.File, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }
    // Lot 1 : modifiable jusqu'à la signature direction incluse — les prestations
    // changent pendant le séjour, la facture de solde se calcule sur le total révisé.
    if (!['EN_ATTENTE', 'SELECTIONNE', 'SIGNE_DIRECTION'].includes(devis.statut)) {
      throw new ForbiddenException('Ce devis ne peut plus être modifié à ce stade');
    }
    // Lot 1 : les devis directs (mariages/événements) sont aussi modifiables.
    // La vérification de propriété (centreId) ci-dessus suffit. demandeId reste optionnel.
    const demandeId: string | null = devis.demandeId;

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
        // numeroDevis non overridable : conservé tel quel (attribué à la création)
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

    // Synchroniser DemandeDevis si effectif modifié (devis collab uniquement)
    if (demandeId && (dto.nombreEleves !== undefined || dto.nombreAccompagnateurs !== undefined)) {
      const demandePourSejour = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
        select: { sejourId: true },
      });

      await this.prisma.demandeDevis.update({
        where: { id: demandeId },
        data: {
          ...(dto.nombreEleves !== undefined && { nombreEleves: dto.nombreEleves }),
          ...(dto.nombreAccompagnateurs !== undefined && { nombreAccompagnateurs: dto.nombreAccompagnateurs }),
        },
      });

      if (dto.nombreEleves !== undefined && demandePourSejour?.sejourId) {
        await this.prisma.sejour.update({
          where: { id: demandePourSejour.sejourId },
          data: { placesTotales: dto.nombreEleves },
        });
      }
    }

    // Notifier l'enseignant si le devis était SELECTIONNE (devis collab uniquement)
    if (demandeId && devis.statut === 'SELECTIONNE') {
      const demande = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
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
    if (user.role === 'ORGANISATEUR') {
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
                prenom: true, nom: true, email: true, telephone: true,
                memberships: {
                  where: { isPrimary: true },
                  select: {
                    organisation: { select: { nom: true, ville: true, uai: true } },
                  },
                  take: 1,
                },
              },
            },
            sejour: {
              select: {
                id: true, titre: true, dateDebut: true, dateFin: true,
                niveauClasse: true, statut: true,
                createur: {
                  select: {
                    prenom: true, nom: true,
                    memberships: {
                      where: { isPrimary: true },
                      select: {
                        organisation: { select: { nom: true, ville: true } },
                      },
                      take: 1,
                    },
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

  async updateStatut(id: string, statut: StatutDevis, userId: string, userRole: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: { demande: true },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (!devis.demande || !devis.demandeId) {
      throw new ForbiddenException('Cette action n\'est pas disponible pour les séjours en gestion directe');
    }
    const demande = devis.demande;
    const demandeId: string = devis.demandeId;

    // ORGANISATEUR can submit for validation or accept/refuse
    if (userRole === Role.ORGANISATEUR) {
      if (demande.enseignantId !== userId) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    // SIGNATAIRE can only reject a devis (NON_RETENU)
    // Selection is done by ORGANISATEUR via EN_ATTENTE_VALIDATION → signerDevis
    if (userRole === Role.SIGNATAIRE) {
      if (statut !== StatutDevis.NON_RETENU) {
        throw new ForbiddenException('Les directeurs peuvent uniquement refuser un devis');
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
        where: { id: demandeId },
        data: { statut: 'FERMEE' },
      });

      // 3. Mettre à jour le séjour : appel d'offres fermé + centre sélectionné + statut CONVENTION
      await this.prisma.sejour.update({
        where: { id: demande.sejourId },
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
        where: { id: demande.sejourId },
        select: { titre: true },
      });
      if (centre?.user?.email && sejour) {
        await this.email.sendDevisSelectionne(
          centre.user.email,
          centre.nom,
          sejour.titre,
        );
      }

      // Auto-rattacher client CRM
      try {
        const orgaEnseignant = demande.enseignantId
          ? await getOrganisationPrincipale(demande.enseignantId, this.prisma)
          : null;
        if (orgaEnseignant?.nom) {
          const clientCree = await this.clientsService.autoRattacherDepuisDevis(
            demande.sejourId,
            devis.centreId,
            orgaEnseignant.uai ?? undefined,
            orgaEnseignant.nom,
            orgaEnseignant.ville ?? undefined,
          );
          // Lier le Client à l'Organisation source si pas encore fait
          if (clientCree && !clientCree.organisationId && orgaEnseignant.id) {
            await this.prisma.client.update({
              where: { id: clientCree.id },
              data: { organisationId: orgaEnseignant.id },
            });
          }
        }
      } catch { /* ne pas bloquer */ }
    }

    // Quand le directeur refuse un devis — passer le séjour en REJECTED
    // et notifier l'enseignant
    if (statut === StatutDevis.NON_RETENU && userRole === Role.SIGNATAIRE) {
      const demandeFull = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
        include: {
          sejour: { select: { id: true, titre: true } },
          enseignant: { select: { email: true, prenom: true, nom: true } },
        },
      });
      if (demandeFull?.sejour?.id) {
        await this.prisma.sejour.update({
          where: { id: demandeFull.sejour.id },
          data: { statut: StatutSejour.REJECTED },
        });
      }
      if (demandeFull?.enseignant && demandeFull?.sejour) {
        await this.email.sendGenericNotification(
          demandeFull.enseignant.email,
          `Devis refusé par la direction — ${demandeFull.sejour.titre}`,
          `<p>Bonjour ${demandeFull.enseignant.prenom},</p>
           <p>Le directeur a refusé le devis pour le séjour <strong>${demandeFull.sejour.titre}</strong>.</p>
           <p>Vous pouvez consulter un autre devis ou soumettre une nouvelle demande depuis votre tableau de bord.</p>`,
        );
      }
    }

    return updated;
  }

  async signerDevis(devisId: string, user: { id: string; role: string }, ipAddress?: string, userAgent?: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        demande: { include: { sejour: true } },
        centre: { include: { user: { select: { email: true } } } },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.statut !== 'SELECTIONNE' && devis.statut !== StatutDevis.EN_ATTENTE_VALIDATION) {
      throw new ForbiddenException('Seul un devis sélectionné ou en attente de validation peut être signé');
    }
    if (!devis.demandeId) {
      throw new ForbiddenException('Cette action n\'est pas disponible pour les séjours en gestion directe');
    }
    const demandeId: string = devis.demandeId;

    if (devis.statut === StatutDevis.EN_ATTENTE_VALIDATION) {
      await this.prisma.devis.update({
        where: { id: devisId },
        data: { statut: StatutDevis.SELECTIONNE },
      });
      await this.prisma.devis.updateMany({
        where: {
          demandeId,
          id: { not: devisId },
          statut: { not: StatutDevis.NON_RETENU },
        },
        data: { statut: StatutDevis.NON_RETENU },
      });
      await this.prisma.demandeDevis.update({
        where: { id: demandeId },
        data: { statut: 'FERMEE' },
      });
      if (devis.demande?.sejour?.id) {
        await this.prisma.sejour.update({
          where: { id: devis.demande.sejour.id },
          data: {
            appelOffreStatut: AppelOffreStatut.FERME,
            hebergementSelectionneId: devis.centreId,
            statut: StatutSejour.CONVENTION,
          },
        });
      }
    }

    const directeur = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { prenom: true, nom: true },
    });
    const nomSignataire = directeur ? `${directeur.prenom} ${directeur.nom}` : 'Directeur';

    const updated = await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        statut: StatutDevis.SIGNE_DIRECTION,
        signatureDirecteur: `Signé électroniquement par ${nomSignataire} — ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
        nomSignataireDirecteur: nomSignataire,
        signatureIpAddress: ipAddress ?? null,
        signatureUserAgent: userAgent ?? null,
        signatureHash: createHash('sha256')
          .update(`${devisId}${user.id}${new Date().toISOString()}${devis.montantTTC ?? '0'}`)
          .digest('hex'),
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
      const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/hebergeur/devis`;
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

  async uploadSignatureDocument(devisId: string, userId: string, file: Express.Multer.File) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        demande: {
          select: {
            enseignantId: true,
            sejourId: true,
            sejour: { select: { titre: true } },
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.demande?.enseignantId !== userId) throw new ForbiddenException('Accès refusé');
    if (devis.statut !== 'SELECTIONNE' && devis.statut !== 'SIGNE_DIRECTION') {
      throw new ForbiddenException('Le devis doit être sélectionné pour uploader un document');
    }
    if (!file || file.mimetype !== 'application/pdf') {
      throw new ForbiddenException('Seuls les fichiers PDF sont acceptés');
    }

    const url = await this.storage.upload(file, 'signatures-direction');

    const updated = await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        signatureDocumentUrl: url,
        statut: 'SIGNE_DIRECTION',
        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
      },
    });

    if (devis.demande?.sejourId) {
      await this.prisma.sejour.update({
        where: { id: devis.demande.sejourId },
        data: { statut: 'SIGNE_DIRECTION' },
      });
    }

    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: devis.centreId },
      include: { user: { select: { email: true } } },
    });
    const sejourTitre = devis.demande?.sejour?.titre ?? 'le séjour';
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    if (centre?.user?.email) {
      await this.email.sendGenericNotification(
        centre.user.email,
        `Devis signé par la direction — ${sejourTitre}`,
        `<p>Bonjour,</p>
         <p>L'organisateur a uploadé le devis signé par la direction pour le séjour <strong>« ${sejourTitre} »</strong>.</p>
         <p>Vous pouvez désormais émettre la facture d'acompte.</p>
         <p style="margin:24px 0">
           <a href="${frontendUrl}/dashboard/hebergeur/devis" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
             Accéder à mes devis
           </a>
         </p>`,
      );
    }

    return updated;
  }

  async getDevisAValider() {
    return this.prisma.devis.findMany({
      where: {
        statut: StatutDevis.EN_ATTENTE_VALIDATION,
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

  /**
   * Aperçu du prochain numéro de devis — LECTURE SEULE, ne consomme PAS le compteur.
   * Le numéro réel est attribué atomiquement à la création (peut donc différer en cas
   * de création concurrente entre l'aperçu et la soumission).
   */
  async getNextNumeroDevis(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const emetteurId = centre.organisationId ?? centre.id;
    const annee = new Date().getFullYear();
    const seq = await this.prisma.sequenceNumero.findUnique({
      where: { emetteurId_annee_typeDoc: { emetteurId, annee, typeDoc: 'DEVIS' } },
      select: { dernierNumero: true },
    });
    const prochain = (seq?.dernierNumero ?? 0) + 1;
    return { numero: `DEV-${annee}-${String(prochain).padStart(4, '0')}`, apercu: true };
  }

  async getDemandeInfo(demandeId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
      include: {
        enseignant: {
          select: {
            prenom: true, nom: true, email: true, telephone: true,
            memberships: {
              where: { isPrimary: true },
              select: {
                organisation: { select: { nom: true, ville: true, uai: true } },
              },
              take: 1,
            },
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

  /**
   * Factures d'acompte en attente de validation (dashboard SIGNATAIRE).
   * Lot 1 : lit l'entité Facture (type ACOMPTE non encore validée), plus le devis.
   */
  async getFacturesAcompte() {
    return this.prisma.facture.findMany({
      where: { typeFacture: 'ACOMPTE', acompteVerse: false },
      include: {
        lignes: true,
        versements: { orderBy: { datePaiement: 'asc' as const } },
        devis: {
          include: {
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
                      select: { prenom: true, nom: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { dateEmission: 'desc' },
    });
  }

  async getVersements(devisId: string) {
    return this.prisma.versementPaiement.findMany({
      where: { devisId },
      orderBy: { datePaiement: 'asc' },
    });
  }

  /** Numéro de devis formaté DEV-{annee}-{NNNN} (consomme la séquence DEVIS). */
  private async formaterNumeroDevis(emetteurId: string): Promise<string> {
    const annee = new Date().getFullYear();
    const numero = await this.sequence.generer(emetteurId, 'DEVIS');
    return `DEV-${annee}-${String(numero).padStart(4, '0')}`;
  }

  async notifierEnseignantModification(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        demande: {
          include: {
            enseignant: { select: { email: true, prenom: true, nom: true } },
            sejour: { select: { id: true, titre: true } },
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) throw new ForbiddenException();

    const enseignant = devis.demande?.enseignant;
    const sejour = devis.demande?.sejour;
    if (!enseignant || !sejour) throw new NotFoundException('Enseignant introuvable');

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    await this.email.sendGenericNotification(
      enseignant.email,
      `Votre devis a été mis à jour — ${sejour.titre}`,
      `<p>Bonjour ${enseignant.prenom},</p>
       <p>L'hébergeur <strong>${centre.nom}</strong> a apporté des modifications au devis <strong>${devis.numeroDevis ?? ''}</strong> pour votre séjour <strong>${sejour.titre}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/dashboard/sejour/${sejour.id}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Consulter le devis mis à jour
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Connectez-vous à LIAVO pour voir les détails complets.</p>`,
    );

    return { success: true };
  }

  // ── Devis DIRECT (gestion hébergeur sans DemandeDevis) ────────────────────

  /**
   * Créer un devis sur un séjour en gestion DIRECT (pas de DemandeDevis).
   */
  async createDirectDevis(
    dto: CreateDevisDto,
    userId: string,
    file?: Express.Multer.File,
    centreId?: string | null,
  ) {
    if (!dto.sejourDirectId) {
      throw new ForbiddenException('sejourDirectId est requis pour un devis direct');
    }
    const sejourDirectId = dto.sejourDirectId;

    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourDirectId },
      select: {
        id: true,
        modeGestion: true,
        hebergementSelectionneId: true,
        titre: true,
        clientNom: true,
        clientEmail: true,
        deletedAt: true,
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Ce séjour n\'est pas en gestion directe');
    }
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    const devisExistant = await this.prisma.devis.findFirst({
      where: {
        sejourDirectId,
        statut: {
          in: [
            StatutDevis.EN_ATTENTE,
            StatutDevis.EN_ATTENTE_VALIDATION,
            StatutDevis.SELECTIONNE,
          ],
        },
      },
    });
    if (devisExistant) {
      throw new ForbiddenException('Un devis actif existe déjà pour ce séjour');
    }

    // Numéro de devis séquentiel atomique par émetteur (non overridable)
    const emetteurId = centre.organisationId ?? centre.id;
    const numeroDevis = await this.formaterNumeroDevis(emetteurId);

    let documentUrl: string | null = null;
    if (file && file.mimetype === 'application/pdf') {
      documentUrl = await this.storage.upload(file, 'devis');
    }

    const devis = await this.prisma.devis.create({
      data: {
        sejourDirectId,
        demandeId: null,
        centreId: centre.id,
        emetteurId,
        montantTotal: dto.montantTotal ?? '0',
        montantParEleve: dto.montantParEleve ?? '0',
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
        documentUrl,
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
        typeDevis: 'PLATEFORME',
      },
    });

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

    return this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });
  }

  /**
   * Envoie un devis DIRECT par email au client avec lien de signature.
   */
  async envoyerDevisDirect(
    devisId: string,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: true,
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            clientNom: true, clientPrenom: true, clientEmail: true, clientTelephone: true,
            clientOrganisation: true, modeGestion: true, placesTotales: true,
            natureSejour: true, typeSejour: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) throw new ForbiddenException();
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new ForbiddenException('Ce devis n\'est pas un devis direct');
    }
    if (devis.sejourDirect.modeGestion !== 'DIRECT') {
      throw new ForbiddenException('Le séjour n\'est pas en gestion directe');
    }

    const clientEmail = devis.sejourDirect.clientEmail;
    if (!clientEmail) {
      throw new ForbiddenException('L\'email du client est requis pour envoyer le devis');
    }

    if (devis.statut !== 'EN_ATTENTE') {
      await this.prisma.devis.update({
        where: { id: devisId },
        data: { statut: StatutDevis.EN_ATTENTE },
      });
    }

    const token = devis.tokenSignature;
    if (!token) {
      throw new ForbiddenException('Token de signature manquant sur le devis');
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const sejour = devis.sejourDirect;

    // ── Génération contrat PDF (si centre a un IBAN — spécifique événements) ──
    let contratUrl: string | null = null;
    const isEvenement = sejour.natureSejour === 'EVENEMENT'
      || sejour.typeSejour?.includes('MARIAGE')
      || sejour.typeSejour?.includes('ANNIVERSAIRE')
      || sejour.typeSejour?.includes('SEMINAIRE')
      || sejour.typeSejour?.includes('TEAM_BUILDING')
      || sejour.typeSejour?.includes('REUNION_FAMILLE');
    if (isEvenement && centre.iban) {
      try {
        const { generateContratSauvageonPdf } = await import('./contrat-sauvageon.pdf.js');

        const round2 = (n: number) => Math.round(n * 100) / 100;
        const montantTTC = devis.montantTTC ?? 0;
        const montantAcompte = devis.montantAcompte ?? (montantTTC * ((devis.pourcentageAcompte ?? 30) / 100));
        const resteAPayer = montantTTC - montantAcompte;

        const pdfBuffer = await generateContratSauvageonPdf({
          nomClient: sejour.clientNom ?? '',
          prenomClient: sejour.clientPrenom,
          adresseClient: null,
          telClient: sejour.clientTelephone,
          emailClient: clientEmail,
          typeEvenement: sejour.typeSejour?.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c: string) => c.toUpperCase()) ?? sejour.titre,
          dateDebut: fmt(sejour.dateDebut),
          dateFin: fmt(sejour.dateFin),
          lignes: (devis.lignes ?? []).map(l => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: round2(Number(l.prixUnitaire)),
            tva: l.tva,
            totalTTC: round2(Number(l.totalTTC)),
          })),
          montantHT: round2(devis.montantHT ?? 0),
          montantTVA: round2(devis.montantTVA ?? 0),
          montantTTC: round2(montantTTC),
          pourcentageAcompte: devis.pourcentageAcompte ?? 30,
          montantAcompte: round2(montantAcompte),
          resteAPayer: round2(resteAPayer),
          dateSignature: fmt(new Date()),
          numeroDevis: devis.numeroDevis,
        });

        contratUrl = await this.storage.uploadBuffer(
          pdfBuffer,
          `contrat-${devis.numeroDevis ?? devis.id}.pdf`,
          'contrats',
          'application/pdf',
        );
      } catch (err) {
        console.error('Erreur génération contrat PDF:', err);
        // non-bloquant : l'email part sans contrat si erreur
      }
    }

    await this.email.sendGenericNotification(
      clientEmail,
      `Devis ${devis.numeroDevis ?? ''} — ${centre.nom}`,
      `<p>Bonjour${sejour.clientNom ? ` ${sejour.clientNom}` : ''},</p>
       <p>Veuillez trouver ci-joint le devis pour :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.titre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Participants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.placesTotales}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant TTC</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td></tr>
       </table>
       ${contratUrl ? `<p style="margin:16px 0">📄 <a href="${contratUrl}" style="color:#1B4060;font-weight:600;text-decoration:underline">Télécharger le contrat PDF</a></p>` : ''}
       <p>Consultez le devis complet et signez-le en ligne :</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/devis/signer/${token}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Si vous ne pouvez pas cliquer sur le bouton, copiez ce lien : ${frontendUrl}/devis/signer/${token}</p>`,
      centre.nom,
    );

    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: sejour.id },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: centre.id,
            type: 'DEVIS',
            description: `Devis ${devis.numeroDevis ?? ''} envoyé — ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`,
            metadata: { devisId, sejourId: sejour.id },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Devis envoyé par email' };
  }

  /**
   * Retourne les données publiques d'un devis via son token de signature.
   */
  async getDevisPublicByToken(token: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        lignes: true,
        centre: {
          select: {
            nom: true, ville: true, adresse: true, codePostal: true,
            siret: true, telephone: true, email: true,
            tvaIntracommunautaire: true, iban: true,
            brochureUrl: true, conditionsAnnulation: true,
          },
        },
        sejourDirect: {
          select: {
            id: true, titre: true, lieu: true,
            dateDebut: true, dateFin: true, placesTotales: true,
            clientNom: true, clientPrenom: true, clientEmail: true,
            clientOrganisation: true, natureSejour: true, typeSejour: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Lien de signature invalide');
    if (!devis.sejourDirectId) {
      throw new NotFoundException('Ce devis n\'utilise pas la signature par lien');
    }

    const isSigned = devis.statut === 'SELECTIONNE' || devis.statut === 'SIGNE_DIRECTION'
      || devis.statut === 'FACTURE_ACOMPTE' || devis.statut === 'FACTURE_SOLDE';

    return {
      id: devis.id,
      numeroDevis: devis.numeroDevis,
      statut: devis.statut,
      montantHT: devis.montantHT,
      montantTVA: devis.montantTVA,
      montantTTC: devis.montantTTC,
      tauxTva: devis.tauxTva,
      pourcentageAcompte: devis.pourcentageAcompte,
      montantAcompte: devis.montantAcompte,
      description: devis.description,
      conditionsAnnulation: devis.conditionsAnnulation,
      nomEntreprise: devis.nomEntreprise,
      adresseEntreprise: devis.adresseEntreprise,
      siretEntreprise: devis.siretEntreprise,
      emailEntreprise: devis.emailEntreprise,
      telEntreprise: devis.telEntreprise,
      createdAt: devis.createdAt,
      lignes: devis.lignes,
      centre: devis.centre,
      sejour: devis.sejourDirect,
      isSigned,
      signatureDirecteur: devis.signatureDirecteur,
      nomSignataireDirecteur: devis.nomSignataireDirecteur,
      dateSignatureDirecteur: devis.dateSignatureDirecteur,
      signatureDocumentUrl: devis.signatureDocumentUrl,
    };
  }

  /**
   * Signature directe par le client (option 1 de la page publique).
   */
  async signerDevisDirect(
    token: string,
    body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
    req: Request,
  ) {
    if (!body.confirmation) {
      throw new ForbiddenException('Vous devez accepter les conditions pour signer');
    }
    if (!body.nomSignataire?.trim()) {
      throw new ForbiddenException('Le nom du signataire est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        centre: { select: { nom: true, email: true } },
        sejourDirect: { select: { id: true, titre: true, clientEmail: true, clientNom: true, dateDebut: true, dateFin: true, modeGestion: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible à la signature par lien');
    }
    if (devis.statut !== 'EN_ATTENTE') {
      throw new ForbiddenException('Ce devis ne peut plus être signé (statut actuel : ' + devis.statut + ')');
    }

    const now = new Date();
    const hash = createHash('sha256')
      .update(`${token}${body.nomSignataire}${now.toISOString()}${devis.montantTTC ?? '0'}`)
      .digest('hex');

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: StatutDevis.SELECTIONNE,
        signatureDirecteur: `Signé électroniquement par ${body.nomSignataire}${body.fonctionSignataire ? ` (${body.fonctionSignataire})` : ''} — ${now.toLocaleDateString('fr-FR')}`,
        nomSignataireDirecteur: body.nomSignataire.trim(),
        dateSignatureDirecteur: now,
        signatureIpAddress: req.ip ?? null,
        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
        signatureHash: hash,
      },
    });

    await this.prisma.sejour.update({
      where: { id: devis.sejourDirect.id },
      data: {
        statut: StatutSejour.CONVENTION,
        hebergementSelectionneId: devis.centreId,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const sejour = devis.sejourDirect;

    if (sejour.clientEmail) {
      try {
        await this.email.sendGenericNotification(
          sejour.clientEmail,
          `Confirmation de réservation — ${sejour.titre}`,
          `<p>Bonjour${sejour.clientNom ? ` ${sejour.clientNom}` : ''},</p>
           <p>Nous confirmons la signature du devis <strong>${devis.numeroDevis}</strong> pour <strong>${sejour.titre}</strong>
           du ${fmt(sejour.dateDebut)} au ${fmt(sejour.dateFin)}.</p>
           <p><strong>Signé par :</strong> ${body.nomSignataire}<br>
           <strong>Date :</strong> ${fmt(now)}</p>
           <p>Un acompte de <strong>${Number(devis.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</strong>
           est à régler selon les conditions convenues.</p>`,
          devis.centre?.nom,
        );
      } catch { /* non bloquant */ }
    }

    if (devis.centre?.email) {
      try {
        await this.email.sendGenericNotification(
          devis.centre.email,
          `Devis signé — ${sejour.titre} · ${sejour.clientNom ?? 'Client'}`,
          `<p>Le devis <strong>${devis.numeroDevis}</strong> a été signé électroniquement.</p>
           <p><strong>Signataire :</strong> ${body.nomSignataire}<br>
           <strong>Séjour :</strong> ${sejour.titre}<br>
           <strong>Dates :</strong> ${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}<br>
           <strong>Montant TTC :</strong> ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p>
           <p style="margin:24px 0">
             <a href="${frontendUrl}/dashboard/hebergeur/planning" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
               Voir le planning
             </a>
           </p>`,
        );
      } catch { /* non bloquant */ }
    }

    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: sejour.id },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: devis.centreId,
            type: 'SIGNATURE',
            description: `Devis ${devis.numeroDevis ?? ''} signé par ${body.nomSignataire}`,
            metadata: { devisId: devis.id, sejourId: sejour.id },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Devis signé avec succès' };
  }

  /**
   * Déléguer la signature à la direction (option 2).
   */
  async envoyerADirection(
    token: string,
    body: { emailDirecteur: string; nomDirecteur?: string },
  ) {
    if (!body.emailDirecteur?.trim()) {
      throw new ForbiddenException('L\'email du signataire est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        sejourDirect: {
          select: {
            id: true, titre: true, clientNom: true,
            clientOrganisation: true, clientOrganisationId: true,
          },
        },
        centre: { select: { nom: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible');
    }
    if (devis.statut !== 'EN_ATTENTE') {
      throw new ForbiddenException('Ce devis ne peut plus être envoyé à la direction');
    }

    const { randomUUID } = await import('crypto');
    const invToken = randomUUID();
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const sejour = devis.sejourDirect;

    // Résoudre l'organisationId pour le Membership signataire (SC4ter).
    // Séjour DIRECT : pas de createurId → clientOrganisationId est la source principale.
    // Fallback null : la source 2 d'getAllSejoursSignataire fonctionne par email.
    const organisationIdPourInvitation: string | null =
      sejour.clientOrganisationId ?? null;

    await this.prisma.invitationDirecteur.create({
      data: {
        token: invToken,
        sejourId: sejour.id,
        devisId: devis.id,
        emailDirecteur: body.emailDirecteur.trim(),
        enseignantPrenom: sejour.clientNom ?? 'L\'organisateur',
        sejourTitre: sejour.titre,
        etablissementNom: sejour.clientOrganisation ?? null,
        organisationId: organisationIdPourInvitation,
        typeContexte: 'SCOLAIRE',
      },
    });

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: { statut: StatutDevis.EN_ATTENTE_VALIDATION },
    });

    await this.email.sendGenericNotification(
      body.emailDirecteur.trim(),
      `Devis à valider — ${sejour.titre}`,
      `<p>Bonjour,</p>
       <p>${sejour.clientNom ?? 'Un organisateur'} vous invite à consulter et signer le devis pour le séjour <strong>${sejour.titre}</strong> au centre <strong>${devis.centre?.nom ?? ''}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/invitation-direction/${invToken}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Consulter et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Si vous n'êtes pas concerné par cette demande, vous pouvez ignorer cet email.</p>`,
      devis.centre?.nom,
    );

    return { success: true, message: 'Invitation envoyée à la direction' };
  }

  /**
   * Upload scan signé par le client (option 3).
   */
  async uploadSignaturePublic(token: string, file: Express.Multer.File, req: Request) {
    if (!file || file.mimetype !== 'application/pdf') {
      throw new ForbiddenException('Un fichier PDF est requis');
    }

    const devis = await this.prisma.devis.findUnique({
      where: { tokenSignature: token },
      include: {
        sejourDirect: { select: { id: true, titre: true, modeGestion: true } },
        centre: { select: { nom: true, email: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (!devis.sejourDirectId || !devis.sejourDirect) {
      throw new NotFoundException('Devis non éligible');
    }
    if (devis.statut !== 'EN_ATTENTE' && devis.statut !== 'EN_ATTENTE_VALIDATION') {
      throw new ForbiddenException('Ce devis ne peut plus recevoir de document signé');
    }

    const documentUrl = await this.storage.upload(file, 'signatures');

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: StatutDevis.SELECTIONNE,
        signatureDocumentUrl: documentUrl,
        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
        dateSignatureDirecteur: new Date(),
        signatureIpAddress: req.ip ?? null,
        signatureUserAgent: (req.headers['user-agent'] as string) ?? null,
      },
    });

    await this.prisma.sejour.update({
      where: { id: devis.sejourDirect.id },
      data: { statut: StatutSejour.CONVENTION },
    });

    if (devis.centre?.email) {
      try {
        const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
        await this.email.sendGenericNotification(
          devis.centre.email,
          `Document signé reçu — ${devis.sejourDirect.titre}`,
          `<p>Un document signé a été uploadé pour le devis <strong>${devis.numeroDevis}</strong>.</p>
           <p style="margin:24px 0">
             <a href="${frontendUrl}/dashboard/hebergeur/planning" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
               Voir le planning
             </a>
           </p>`,
        );
      } catch { /* non bloquant */ }
    }

    return { success: true, message: 'Document signé reçu' };
  }

  /** Annule un devis (statut → NON_RETENU). Bloque si une FA est émise sans avoir. */
  async annulerDevis(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        sejourDirect: { select: { id: true } },
        factures: { select: { id: true, typeFacture: true } },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }

    const statutsAnnulables: StatutDevis[] = [
      StatutDevis.EN_ATTENTE,
      StatutDevis.SELECTIONNE,
      StatutDevis.SIGNE_DIRECTION,
    ];
    if (!statutsAnnulables.includes(devis.statut)) {
      throw new ForbiddenException(
        'Ce devis ne peut pas être annulé à ce stade. ' +
        'Si une facture a déjà été émise, utilisez la procédure d\'avoir.'
      );
    }

    // Si une FA existe sans avoir → bloquer, orienter vers l'avoir
    const fa = devis.factures.find((f) => f.typeFacture === 'ACOMPTE');
    if (fa) {
      const avoir = await this.prisma.facture.findUnique({
        where: { factureAnnuleeId: fa.id },
      });
      if (!avoir) {
        throw new ForbiddenException(
          'Une facture d\'acompte a été émise. Émettez d\'abord un avoir ' +
          'depuis l\'onglet Devis & Facturation avant d\'annuler.'
        );
      }
    }

    await this.prisma.devis.update({
      where: { id: devisId },
      data: { statut: StatutDevis.NON_RETENU },
    });

    // Log CRM non bloquant
    try {
      const sejourId = devis.sejourDirectId;
      if (sejourId) {
        const sejourClient = await this.prisma.sejourClient.findFirst({
          where: { sejourId },
          select: { clientId: true },
        });
        if (sejourClient) {
          await this.prisma.activiteClient.create({
            data: {
              clientId: sejourClient.clientId,
              centreId: centre.id,
              type: 'ANNULATION',
              description: `Devis ${devis.numeroDevis ?? devisId} annulé`,
              metadata: { devisId },
            },
          });
        }
      }
    } catch { /* non bloquant */ }

    return { success: true };
  }
}
