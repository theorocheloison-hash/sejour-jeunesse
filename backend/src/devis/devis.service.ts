import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { StatutDevis, StatutSejour, AppelOffreStatut, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { CreateDevisComplementaireDto } from './dto/create-devis-complementaire.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';
import { ClientsService } from '../clients/clients.service.js';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers.js';
import { getCentreForUser } from '../centres/centre.helper.js';
import { formatParticipants } from '../utils/format.js';
import { SequenceService } from '../sequence/sequence.service.js';
import {
  assertSignataireCanAccessDemande,
  assertHebergeurCanAccessDemande,
  getSignataireSejourIds,
} from '../auth/ownership.helper.js';

// Échappe le HTML d'un message libre avant injection dans un email (anti-XSS)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
          produitCatalogueId: l.produitCatalogueId ?? null,
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
      // Magic link pour accès direct sans mot de passe (inline pour éviter une
      // dépendance circulaire vers AuthService — logique identique à genererMagicUrl).
      const magicToken = randomUUID();
      const magicExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      await this.prisma.user.update({
        where: { id: demande.enseignantId! },
        data: { magicLinkToken: magicToken, magicLinkExpires: magicExpires },
      });
      const magicUrl = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/auth/magic/${magicToken}`;
      await this.email.sendDevisRecu(
        enseignant.email,
        `${enseignant.prenom} ${enseignant.nom}`,
        sejour.titre,
        centre.nom,
        String(dto.montantTotal),
        magicUrl,
      );
    }

    // Log CRM non bloquant — client peut ne pas être rattaché en collab
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: demande.sejourId },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: centre.id,
            sejourId: demande.sejourId,
            type: 'DEVIS',
            description: `Devis ${numeroDevis} soumis — ${sejour?.titre ?? ''}`,
            metadata: {
              devisId: devis.id,
              emailType: 'DEVIS_COLLAB',
              to: enseignant?.email ?? '',
              subject: `Nouveau devis reçu — ${sejour?.titre ?? ''}`,
              messagePreview: '',
            },
            userId,
          },
        });
      }
    } catch { /* non bloquant */ }

    return fullDevis;
  }

  async getMesDevis(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    return this.prisma.devis.findMany({
      where: { centreId: centre.id },
      include: {
        lignes: true,
        // Séjour DIRECT (titre pour l'affichage, deletedAt pour détecter un séjour supprimé).
        // dateDebut/dateFin/modeGestion alignés sur getDevisById() pour cohérence du type frontend.
        sejourDirect: { select: { id: true, titre: true, dateDebut: true, dateFin: true, modeGestion: true, natureSejour: true, deletedAt: true, clientNom: true, clientEmail: true, clientOrganisation: true } },
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
            logoUrl: true,
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

  /**
   * Retourne le devis principal actif d'un séjour (DIRECT ou COLLAB).
   * Unifie les deux chemins de données existants.
   */
  async getDevisForSejour(sejourId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findFirst({
      where: {
        centreId: centre.id,
        isComplementaire: false,
        statut: { not: StatutDevis.NON_RETENU },
        OR: [
          { sejourDirectId: sejourId },
          { demande: { sejourId } },
        ],
      },
      include: {
        lignes: true,
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            modeGestion: true, natureSejour: true, deletedAt: true,
          },
        },
        factures: {
          include: { lignes: true, versements: { orderBy: { datePaiement: 'asc' as const } } },
          orderBy: { dateEmission: 'asc' as const },
        },
        centre: {
          select: {
            id: true, nom: true, ville: true, adresse: true, codePostal: true,
            siret: true, telephone: true, email: true,
            tvaIntracommunautaire: true, iban: true, conditionsAnnulation: true,
            logoUrl: true,
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

    return devis;
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
                placesTotales: true, nombreAccompagnateurs: true, niveauClasse: true,
              },
            },
          },
        },
        // Séjour DIRECT : permet à la page de modification d'afficher l'objet et le
        // destinataire (client) pour un devis direct (pas de demande/enseignant).
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            clientNom: true, clientEmail: true, clientOrganisation: true, modeGestion: true,
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
        // Destinataire (devis complémentaire) — modifiable après création
        destinataireNom: dto.destinataireNom ?? devis.destinataireNom,
        destinataireAdresse: dto.destinataireAdresse ?? devis.destinataireAdresse,
        destinataireCodePostal: dto.destinataireCodePostal ?? devis.destinataireCodePostal,
        destinataireVille: dto.destinataireVille ?? devis.destinataireVille,
        destinataireSiret: dto.destinataireSiret ?? devis.destinataireSiret,
        destinataireEmail: dto.destinataireEmail ?? devis.destinataireEmail,
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
          produitCatalogueId: l.produitCatalogueId ?? null,
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
        // Log CRM non bloquant
        try {
          const sejourClient = await this.prisma.sejourClient.findFirst({
            where: { sejourId: demande.sejourId },
            select: { clientId: true },
          });
          if (sejourClient) {
            await this.prisma.activiteClient.create({
              data: {
                clientId: sejourClient.clientId,
                centreId: centre.id,
                sejourId: demande.sejourId,
                type: 'EMAIL',
                description: `Notification modification devis — ${demande.sejour.titre}`,
                metadata: {
                  devisId: id,
                  emailType: 'MODIFICATION_DEVIS_AUTO',
                  to: demande.enseignant.email,
                  subject: 'Devis modifié par l\'hébergeur',
                  messagePreview: '',
                },
                userId,
              },
            });
          }
        } catch { /* non bloquant */ }
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

    if (user.role === 'SIGNATAIRE') {
      await assertSignataireCanAccessDemande(this.prisma, user, demandeId);
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
            tvaIntracommunautaire: true,
            capacite: true,
            logoUrl: true,
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
      if (devis.demandeId) {
        await assertSignataireCanAccessDemande(this.prisma, { id: userId }, devis.demandeId);
      } else {
        throw new ForbiddenException('Accès refusé');
      }
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

    // Quand le directeur refuse un devis — notifier l'enseignant.
    // (Le séjour n'est PAS muté : le statut REJECTED a été retiré de StatutSejour ;
    //  le devis porte déjà NON_RETENU, le séjour reste dans son statut courant.)
    if (statut === StatutDevis.NON_RETENU && userRole === Role.SIGNATAIRE) {
      const demandeFull = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
        include: {
          sejour: { select: { id: true, titre: true } },
          enseignant: { select: { email: true, prenom: true, nom: true } },
        },
      });
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

    // Ownership SIGNATAIRE (R2) — un signataire ne peut signer que les devis de son établissement
    await assertSignataireCanAccessDemande(this.prisma, user, devis.demandeId);

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

    // Log CRM non bloquant
    try {
      const sejourIdLog = devis.demande?.sejour?.id;
      if (sejourIdLog) {
        const sejourClient = await this.prisma.sejourClient.findFirst({
          where: { sejourId: sejourIdLog },
          select: { clientId: true },
        });
        if (sejourClient) {
          await this.prisma.activiteClient.create({
            data: {
              clientId: sejourClient.clientId,
              centreId: devis.centreId,
              sejourId: sejourIdLog,
              type: 'SIGNATURE',
              description: `Devis signé par la direction — ${devis.demande?.sejour?.titre ?? ''}`,
              metadata: {
                devisId,
                emailType: 'SIGNATURE_DIRECTION',
                to: devis.centre?.user?.email ?? '',
                subject: `Devis signé par la direction — ${devis.demande?.sejour?.titre ?? ''}`,
                messagePreview: '',
              },
              userId: user.id,
            },
          });
        }
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  async uploadSignatureDocument(
    devisId: string,
    userId: string,
    file: Express.Multer.File,
    nomSignataire?: string,
  ) {
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

    const nomSignataireClean = nomSignataire?.trim().slice(0, 255) || null;

    const updated = await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        signatureDocumentUrl: url,
        statut: 'SIGNE_DIRECTION',
        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
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

    // Log CRM non bloquant
    try {
      const sejourIdLog = devis.demande?.sejourId;
      if (sejourIdLog) {
        const sejourClient = await this.prisma.sejourClient.findFirst({
          where: { sejourId: sejourIdLog },
          select: { clientId: true },
        });
        if (sejourClient) {
          await this.prisma.activiteClient.create({
            data: {
              clientId: sejourClient.clientId,
              centreId: devis.centreId,
              sejourId: sejourIdLog,
              type: 'SIGNATURE',
              description: `Document signé uploadé — ${devis.demande?.sejour?.titre ?? ''}`,
              metadata: {
                devisId,
                emailType: 'SIGNATURE_UPLOAD',
                to: centre?.user?.email ?? '',
                subject: `Devis signé — ${devis.demande?.sejour?.titre ?? ''}`,
                messagePreview: '',
              },
              userId,
            },
          });
        }
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  /**
   * L'hébergeur enregistre une signature direction reçue hors plateforme (email, courrier).
   * Accepte un PDF signé (optionnel) et un nom de signataire.
   * Fonctionne pour les devis COLLAB et DIRECT au statut SELECTIONNE.
   */
  async marquerDevisSigneHebergeur(
    devisId: string,
    userId: string,
    file?: Express.Multer.File,
    nomSignataire?: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        demande: { select: { sejourId: true, sejour: { select: { titre: true } } } },
        sejourDirect: { select: { id: true, titre: true } },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) {
      throw new ForbiddenException('Ce devis ne vous appartient pas');
    }
    if (devis.statut !== 'SELECTIONNE') {
      throw new ForbiddenException(
        'Le devis doit être au statut Sélectionné pour enregistrer la signature direction',
      );
    }

    let signatureDocumentUrl: string | null = null;
    if (file && file.mimetype === 'application/pdf') {
      signatureDocumentUrl = await this.storage.upload(file, 'signatures-direction');
    }

    const nomSignataireClean = nomSignataire?.trim().slice(0, 255) || null;
    const sejourId = devis.sejourDirectId ?? devis.demande?.sejourId ?? null;
    const sejourTitre = devis.sejourDirect?.titre ?? devis.demande?.sejour?.titre ?? '';

    const updated = await this.prisma.devis.update({
      where: { id: devisId },
      data: {
        statut: StatutDevis.SIGNE_DIRECTION,
        ...(signatureDocumentUrl ? { signatureDocumentUrl } : {}),
        signatureDirecteur: nomSignataireClean
          ? `Signé par ${nomSignataireClean} — enregistré le ${new Date().toLocaleDateString('fr-FR')}`
          : `Signature direction enregistrée le ${new Date().toLocaleDateString('fr-FR')}`,
        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
        dateSignatureDirecteur: new Date(),
      },
    });

    if (sejourId) {
      await this.prisma.sejour.update({
        where: { id: sejourId },
        data: { statut: StatutSejour.SIGNE_DIRECTION },
      });
    }

    // Log CRM non bloquant
    try {
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
              sejourId,
              type: 'SIGNATURE',
              description: `Signature direction enregistrée — ${sejourTitre}`,
              metadata: {
                devisId,
                emailType: 'SIGNATURE_DIRECTION_HEBERGEUR',
              },
              userId,
            },
          });
        }
      }
    } catch { /* non bloquant */ }

    return updated;
  }

  async getDevisAValider(userId: string) {
    const sejourIds = await getSignataireSejourIds(this.prisma, userId);
    if (sejourIds.length === 0) return [];
    return this.prisma.devis.findMany({
      where: {
        statut: StatutDevis.EN_ATTENTE_VALIDATION,
        typeDocument: 'DEVIS',
        OR: [
          { demande: { sejourId: { in: sejourIds } } },
          { sejourDirectId: { in: sejourIds } },
        ],
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
            nombreAccompagnateurs: true,
            niveauClasse: true,
          },
        },
      },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');

    await assertHebergeurCanAccessDemande(this.prisma, centre.id, demandeId);

    return { demande, centre };
  }

  /**
   * Factures d'acompte en attente de validation (dashboard SIGNATAIRE).
   * Lot 1 : lit l'entité Facture (type ACOMPTE non encore validée), plus le devis.
   */
  async getFacturesAcompte(userId: string) {
    const sejourIds = await getSignataireSejourIds(this.prisma, userId);
    if (sejourIds.length === 0) return [];
    return this.prisma.facture.findMany({
      where: {
        typeFacture: 'ACOMPTE',
        acompteVerse: false,
        devis: {
          OR: [
            { demande: { sejourId: { in: sejourIds } } },
            { sejourDirectId: { in: sejourIds } },
          ],
        },
      },
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

    // Log CRM non bloquant
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
            sejourId: sejour.id,
            type: 'EMAIL',
            description: `Notification modification envoyée — ${sejour.titre}`,
            metadata: {
              devisId,
              emailType: 'MODIFICATION_DEVIS',
              to: enseignant.email,
              subject: `Votre devis a été mis à jour — ${sejour.titre}`,
              messagePreview: '',
            },
            userId,
          },
        });
      }
    } catch { /* non bloquant */ }

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
          produitCatalogueId: l.produitCatalogueId ?? null,
        })),
      });
    }

    return this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });
  }

  /**
   * Crée un devis COMPLÉMENTAIRE sur un séjour direct : payeur additionnel (AS, Mairie…)
   * avec destinataire propre. N'impacte ni le séjour, ni le devis principal, ni le CRM.
   */
  async createDevisComplementaire(
    dto: CreateDevisComplementaireDto,
    userId: string,
    centreId?: string | null,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourDirectId },
      select: { id: true, hebergementSelectionneId: true, deletedAt: true },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    const emetteurId = centre.organisationId ?? centre.id;
    const numeroDevis = await this.formaterNumeroDevis(emetteurId);

    const montantTTC = dto.lignes.reduce((s, l) => s + (l.totalTTC ?? 0), 0);
    const montantHT = dto.lignes.reduce((s, l) => s + (l.totalHT ?? 0), 0);
    const montantTVA = montantTTC - montantHT;

    const devis = await this.prisma.devis.create({
      data: {
        sejourDirectId: dto.sejourDirectId,
        demandeId: null,
        centreId: centre.id,
        emetteurId,
        isComplementaire: true,
        destinataireNom: dto.destinataireNom,
        destinataireAdresse: dto.destinataireAdresse ?? null,
        destinataireCodePostal: dto.destinataireCodePostal ?? null,
        destinataireVille: dto.destinataireVille ?? null,
        destinataireSiret: dto.destinataireSiret ?? null,
        destinataireEmail: dto.destinataireEmail ?? null,
        montantParEleve: 0, // pas de sens pour un complémentaire (colonne NOT NULL)
        montantTotal: montantTTC,
        montantHT,
        montantTVA,
        montantTTC,
        tauxTva: dto.tauxTva ?? 0,
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
        statut: StatutDevis.EN_ATTENTE,
        typeDevis: 'COMPLEMENTAIRE',
        // Pas d'acompte : les complémentaires sont facturés directement (facture totale).
        pourcentageAcompte: null,
        montantAcompte: null,
        numeroDevis,
      },
    });

    await this.prisma.ligneDevis.createMany({
      data: dto.lignes.map((l) => ({
        devisId: devis.id,
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva ?? 0,
        totalHT: l.totalHT,
        totalTTC: l.totalTTC,
        produitCatalogueId: l.produitCatalogueId ?? null,
      })),
    });

    // NE mute PAS le séjour, ne notifie pas, ne rattache pas de Client CRM.
    return this.prisma.devis.findUnique({
      where: { id: devis.id },
      include: { lignes: true },
    });
  }

  /** Liste les devis complémentaires d'un séjour (avec factures + versements). */
  async getDevisComplementaires(sejourId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: { hebergementSelectionneId: true },
    });
    if (!sejour || sejour.hebergementSelectionneId !== centre.id) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }

    return this.prisma.devis.findMany({
      where: { sejourDirectId: sejourId, isComplementaire: true },
      include: {
        lignes: true,
        factures: { include: { lignes: true, versements: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Envoie un devis DIRECT par email au client avec lien de signature.
   */
  async envoyerDevisDirect(
    devisId: string,
    userId: string,
    centreId?: string | null,
    messagePersonnalise?: string,
  ) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    // Message libre de l'hébergeur : trim + tronqué à 2000 + échappé + sauts de ligne
    const messageEchappe = messagePersonnalise
      ? escapeHtml(messagePersonnalise.trim().slice(0, 2000)).replace(/\n/g, '<br>')
      : '';
    const messageBlock = messageEchappe
      ? `<div style="margin:16px 0; padding:16px; background:#f5f4f1; border-radius:8px; border-left:3px solid #C87D2E; font-size:14px; color:#333; line-height:1.6;">${messageEchappe}</div>`
      : '';

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: true,
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            clientNom: true, clientPrenom: true, clientEmail: true, clientTelephone: true,
            clientOrganisation: true, modeGestion: true, placesTotales: true,
            nombreAccompagnateurs: true,
            natureSejour: true, typeSejour: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.isComplementaire) {
      throw new ForbiddenException('Utilisez l\'envoi dédié pour les devis complémentaires');
    }
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
    const fmt = (d: Date | null) => d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Dates à confirmer';
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
          iban: centre.iban,
          bic: null,     // TODO: ajouter bic au modèle CentreHebergement quand multi-centre
          banque: null,  // TODO: idem
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
      `<p>Bonjour${[sejour.clientPrenom, sejour.clientNom].filter(Boolean).join(' ') ? ` ${[sejour.clientPrenom, sejour.clientNom].filter(Boolean).join(' ')}` : ''},</p>
       <p>Veuillez trouver ci-joint le devis pour :</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${sejour.titre}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${fmt(sejour.dateDebut)} → ${fmt(sejour.dateFin)}</td></tr>
         <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Participants</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${formatParticipants(sejour.placesTotales, sejour.nombreAccompagnateurs)}</td></tr>
         <tr><td style="padding:8px 12px;font-size:13px;color:#666">Montant TTC</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td></tr>
       </table>
       ${contratUrl ? `<p style="margin:16px 0">📄 <a href="${contratUrl}" style="color:#1B4060;font-weight:600;text-decoration:underline">Télécharger le contrat PDF</a></p>` : ''}
       ${messageBlock}
       <p>Consultez le devis complet et signez-le en ligne :</p>
       <p style="margin:24px 0">
         <a href="${frontendUrl}/devis/signer/${token}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Voir et signer le devis
         </a>
       </p>
       <p style="font-size:12px;color:#9ca3af;">Si vous ne pouvez pas cliquer sur le bouton, copiez ce lien : ${frontendUrl}/devis/signer/${token}</p>`,
      centre.nom,
      centre.email ? { name: centre.nom, email: centre.email } : undefined,
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
            sejourId: sejour.id,
            type: 'DEVIS',
            description: `Devis ${devis.numeroDevis ?? ''} envoyé — ${Number(devis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`,
            metadata: {
              devisId,
              sejourId: sejour.id,
              emailType: 'DEVIS',
              to: clientEmail,
              subject: `Devis ${devis.numeroDevis ?? ''} — ${centre.nom}`,
              messagePreview: messagePersonnalise?.trim().slice(0, 2000) ?? '',
            },
            userId,
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Devis envoyé par email' };
  }

  /**
   * Génère la convention de séjour scolaire (phase 1 : template Sauvageon hardcodé),
   * la stocke sur OVH, persiste l'URL et envoie un email à l'établissement.
   * Déclenché par l'hébergeur APRÈS signature du devis (idempotent).
   */
  /**
   * Construit le PDF de la convention scolaire (DIRECT ou COLLABORATIF) SANS effet
   * de bord : aucun upload OVH, aucune sauvegarde `conventionUrl`, aucun email,
   * aucun log CRM. Partagé par l'aperçu (GET preview) et l'envoi (POST convention).
   * Effectue les vérifications partagées : ownership, statut signé, nature SEJOUR.
   * (Méthode publique car appelée aussi par le contrôleur pour l'aperçu.)
   */
  async buildConventionScolairePdf(
    devisId: string,
    userId: string,
    centreId?: string | null,
  ): Promise<{
    buffer: Buffer;
    contactEmail: string | null;
    contactNom: string;
    sejourTitre: string;
    sejourId: string;
    centreId: string;
    centreNom: string;
    centreEmail: string | null;
    dateDebutFmt: string;
    dateFinFmt: string;
    effectifEleves: number;
    effectifEncadrants: number;
    fileName: string;
  }> {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: true,
        sejourDirect: {
          select: {
            id: true, titre: true, dateDebut: true, dateFin: true,
            clientNom: true, clientPrenom: true, clientEmail: true, clientTelephone: true,
            clientOrganisation: true, clientAdresse: true, clientCodePostal: true, clientVille: true,
            placesTotales: true, nombreAccompagnateurs: true,
            modeGestion: true, natureSejour: true,
          },
        },
        // Séjour COLLABORATIF : données portées par la demande + l'enseignant.
        demande: {
          select: {
            enseignantId: true,
            sejour: {
              select: {
                id: true, titre: true, dateDebut: true, dateFin: true,
                placesTotales: true, nombreAccompagnateurs: true, natureSejour: true,
              },
            },
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.centreId !== centre.id) throw new ForbiddenException('Ce devis ne vous appartient pas');
    if (devis.isComplementaire) {
      throw new ForbiddenException('Un devis complémentaire ne donne pas lieu à une convention');
    }
    // DIRECT → séjour porté par sejourDirect ; COLLABORATIF → par demande.sejour.
    const sejourSource = devis.sejourDirect ?? devis.demande?.sejour ?? null;
    if (!sejourSource) {
      throw new ForbiddenException('Ce devis n\'est rattaché à aucun séjour');
    }
    if (!['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'].includes(devis.statut)) {
      throw new ForbiddenException('Le devis doit être signé pour générer la convention');
    }

    // Pas de court-circuit idempotent : le PDF est toujours (re)construit pour refléter
    // l'état courant du devis (l'hébergeur peut le modifier puis renvoyer la convention).
    const sejour = sejourSource;
    const fmtDate = (d: Date | null) => d
      ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Dates à confirmer';
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const montantTTC = devis.montantTTC ?? 0;
    const pourcentageAcompte = devis.pourcentageAcompte ?? 30;
    const montantAcompte = devis.montantAcompte ?? (montantTTC * (pourcentageAcompte / 100));
    const effectifEncadrants = sejour.nombreAccompagnateurs ?? 0;
    // placesTotales = effectif élèves ; encadrants comptés séparément (nombreAccompagnateurs).
    const effectifEleves = sejour.placesTotales ?? 0;

    // Contact / établissement : DIRECT → infos client portées par le séjour ;
    // COLLABORATIF → enseignant créateur + son organisation principale.
    let contactNom: string;
    let contactEmail: string | null;
    let etablissementNom: string;
    let etablissementAdresse: string | null;

    if (devis.sejourDirect) {
      const sd = devis.sejourDirect;
      contactNom = [sd.clientPrenom, sd.clientNom].filter(Boolean).join(' ') || 'l\'établissement';
      contactEmail = sd.clientEmail;
      etablissementNom = sd.clientOrganisation || sd.clientNom || 'Établissement scolaire';
      etablissementAdresse = [sd.clientAdresse, [sd.clientCodePostal, sd.clientVille].filter(Boolean).join(' ')]
        .filter(Boolean).join(', ') || null;
    } else {
      const enseignantId = devis.demande?.enseignantId ?? null;
      const enseignant = enseignantId
        ? await this.prisma.user.findUnique({
            where: { id: enseignantId },
            select: { prenom: true, nom: true, email: true },
          })
        : null;
      const orga = enseignantId
        ? await getOrganisationPrincipale(enseignantId, this.prisma)
        : null;
      contactNom = [enseignant?.prenom, enseignant?.nom].filter(Boolean).join(' ') || 'l\'établissement';
      contactEmail = enseignant?.email ?? null;
      etablissementNom = orga?.nom || 'Établissement scolaire';
      etablissementAdresse = orga
        ? [orga.adresse, [orga.codePostal, orga.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null
        : null;
    }

    // Données communes aux deux flux (couverture générique + legacy Sauvageon).
    const baseData = {
      centreNom: centre.nom,
      centreAdresse: centre.adresse ?? '',
      centreCodePostal: centre.codePostal ?? '',
      centreVille: centre.ville ?? '',
      centreTelephone: centre.telephone ?? '',
      centreEmail: centre.email ?? '',
      centreSiret: centre.siret ?? '',
      etablissementNom,
      etablissementAdresse,
      contactNom,
      contactEmail,
      dateDebut: fmtDate(sejour.dateDebut),
      dateFin: fmtDate(sejour.dateFin),
      effectifEleves,
      effectifEncadrants,
      sejourTitre: sejour.titre,
      numeroDevis: devis.numeroDevis,
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
      pourcentageAcompte,
      montantAcompte: round2(montantAcompte),
      dateDocument: fmtDate(new Date()),
    };

    // ── BRANCHING : convention configurable (couverture LIAVO + PDF centre) vs legacy Sauvageon ──
    let pdfBuffer: Buffer;

    if (centre.conventionPdfUrl) {
      // Représentant = utilisateur connecté (pas de nom hardcodé pour la couverture générique).
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { prenom: true, nom: true },
      });
      const representant = [user?.prenom, user?.nom].filter(Boolean).join(' ') || 'Le responsable';

      const { generateConventionCouverturePdf } = await import('./convention-couverture.pdf.js');
      const couvertureBuffer = await generateConventionCouverturePdf({ ...baseData, centreRepresentant: representant });

      // Récupérer le PDF de conditions du centre (URL OVH) via fetch natif Node 20.
      const centreConventionResponse = await fetch(centre.conventionPdfUrl);
      if (!centreConventionResponse.ok) {
        throw new Error('Impossible de récupérer le PDF de convention du centre');
      }
      const centreConventionBytes = new Uint8Array(await centreConventionResponse.arrayBuffer());

      // Fusion : couverture LIAVO (page 1) + convention du centre (pages 2+).
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();
      const couvertureDoc = await PDFDocument.load(couvertureBuffer);
      const centreDoc = await PDFDocument.load(centreConventionBytes);

      const couverturePages = await mergedPdf.copyPages(couvertureDoc, couvertureDoc.getPageIndices());
      couverturePages.forEach(p => mergedPdf.addPage(p));
      const centrePages = await mergedPdf.copyPages(centreDoc, centreDoc.getPageIndices());
      centrePages.forEach(p => mergedPdf.addPage(p));

      pdfBuffer = Buffer.from(await mergedPdf.save());
    } else {
      // Legacy Sauvageon : représentant = directrice.
      const { generateConventionScolaireSauvageonPdf } = await import('./convention-scolaire-sauvageon.pdf.js');
      pdfBuffer = await generateConventionScolaireSauvageonPdf({ ...baseData, centreRepresentant: 'Maëva Roche-Loison' });
    }

    return {
      buffer: pdfBuffer,
      contactEmail,
      contactNom,
      sejourTitre: sejour.titre,
      sejourId: sejour.id,
      centreId: centre.id,
      centreNom: centre.nom,
      centreEmail: centre.email ?? null,
      dateDebutFmt: fmtDate(sejour.dateDebut),
      dateFinFmt: fmtDate(sejour.dateFin),
      effectifEleves,
      effectifEncadrants,
      fileName: `convention-${devis.numeroDevis ?? devis.id}.pdf`,
    };
  }

  /**
   * Génère ET envoie la convention : (re)construit le PDF via buildConventionScolairePdf,
   * l'upload sur OVH (écrase le précédent — même nom de fichier), sauvegarde conventionUrl,
   * envoie l'email au contact et journalise l'activité CRM.
   */
  async genererConventionScolaire(devisId: string, userId: string, centreId?: string | null) {
    const built = await this.buildConventionScolairePdf(devisId, userId, centreId);

    const conventionUrl = await this.storage.uploadBuffer(
      built.buffer,
      built.fileName,
      'conventions',
      'application/pdf',
    );

    await this.prisma.devis.update({
      where: { id: devisId },
      data: { conventionUrl },
    });

    const sujetConvention = `Convention de séjour — ${built.sejourTitre} · ${built.centreNom}`;

    if (built.contactEmail) {
      await this.email.sendGenericNotification(
        built.contactEmail,
        sujetConvention,
        `<p>Bonjour${built.contactNom !== 'l\'établissement' ? ` ${built.contactNom}` : ''},</p>
         <p>Veuillez trouver ci-dessous la convention de séjour scolaire pour votre groupe au Chalet ${built.centreNom}.</p>
         <table style="width:100%;border-collapse:collapse;margin:16px 0">
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Séjour</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${built.sejourTitre}</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Dates</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${built.dateDebutFmt} → ${built.dateFinFmt}</td></tr>
           <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Effectif</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${built.effectifEleves} élèves · ${built.effectifEncadrants} encadrants</td></tr>
           <tr><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${built.centreNom}</td></tr>
         </table>
         <p>Merci de nous retourner un exemplaire signé, précédé de la mention « lu et approuvé ».</p>
         <p style="margin:24px 0">
           <a href="${conventionUrl}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
             Télécharger la convention
           </a>
         </p>
         <p style="font-size:12px;color:#9ca3af;">Si vous ne pouvez pas cliquer sur le bouton, copiez ce lien : ${conventionUrl}</p>`,
        built.centreNom,
        built.centreEmail ? { name: built.centreNom, email: built.centreEmail } : undefined,
      );
    }

    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: built.sejourId },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: built.centreId,
            sejourId: built.sejourId,
            type: 'DEVIS',
            description: built.contactEmail
              ? `Convention envoyée — ${built.sejourTitre}`
              : `Convention générée — ${built.sejourTitre}`,
            metadata: {
              devisId,
              sejourId: built.sejourId,
              conventionUrl,
              ...(built.contactEmail
                ? {
                    emailType: 'CONVENTION',
                    to: built.contactEmail,
                    subject: sujetConvention,
                    messagePreview: '',
                  }
                : {}),
            },
            userId,
          },
        });
      }
    } catch { /* non bloquant */ }

    return { conventionUrl, success: true };
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
            logoUrl: true,
          },
        },
        sejourDirect: {
          select: {
            id: true, titre: true, lieu: true,
            dateDebut: true, dateFin: true, placesTotales: true,
            nombreAccompagnateurs: true,
            clientNom: true, clientPrenom: true, clientEmail: true,
            clientOrganisation: true, natureSejour: true, typeSejour: true,
            clientAdresse: true, clientCodePostal: true, clientVille: true,
          },
        },
      },
    });
    if (!devis) throw new NotFoundException('Lien de signature invalide');
    if (devis.isComplementaire) throw new NotFoundException('Lien invalide');
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
      // PDF du devis uploadé par l'hébergeur (le cas échéant) — sert au bouton de
      // téléchargement public ; null si le devis est généré (PDF reconstruit côté client).
      documentUrl: devis.documentUrl,
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
        sejourDirect: { select: { id: true, titre: true, clientEmail: true, clientNom: true, clientPrenom: true, dateDebut: true, dateFin: true, modeGestion: true } },
      },
    });
    if (!devis) throw new NotFoundException('Lien invalide');
    if (devis.isComplementaire) {
      throw new ForbiddenException('Un devis complémentaire ne peut pas être signé');
    }
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
    const fmt = (d: Date | null) => d ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Dates à confirmer';
    const sejour = devis.sejourDirect;

    if (sejour.clientEmail) {
      try {
        await this.email.sendGenericNotification(
          sejour.clientEmail,
          `Confirmation de réservation — ${sejour.titre}`,
          `<p>Bonjour${[sejour.clientPrenom, sejour.clientNom].filter(Boolean).join(' ') ? ` ${[sejour.clientPrenom, sejour.clientNom].filter(Boolean).join(' ')}` : ''},</p>
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
            sejourId: sejour.id,
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
    if (devis.isComplementaire) {
      throw new ForbiddenException('Un devis complémentaire ne peut pas être signé');
    }
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

    // Log CRM non bloquant
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
            sejourId: sejour.id,
            type: 'EMAIL',
            description: `Invitation direction envoyée — ${sejour.titre}`,
            metadata: {
              devisId: devis.id,
              emailType: 'INVITATION_DIRECTION',
              to: body.emailDirecteur.trim(),
              subject: `Devis à valider — ${sejour.titre}`,
              messagePreview: '',
            },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Invitation envoyée à la direction' };
  }

  /**
   * Upload scan signé par le client (option 3).
   */
  async uploadSignaturePublic(
    token: string,
    file: Express.Multer.File,
    req: Request,
    nomSignataire?: string,
  ) {
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

    const nomSignataireClean = nomSignataire?.trim().slice(0, 255) || null;

    await this.prisma.devis.update({
      where: { id: devis.id },
      data: {
        statut: StatutDevis.SELECTIONNE,
        signatureDocumentUrl: documentUrl,
        signatureDirecteur: `Document signé uploadé le ${new Date().toLocaleDateString('fr-FR')}`,
        ...(nomSignataireClean ? { nomSignataireDirecteur: nomSignataireClean } : {}),
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

    // Log CRM non bloquant
    try {
      const sejourClient = await this.prisma.sejourClient.findFirst({
        where: { sejourId: devis.sejourDirect!.id },
        select: { clientId: true },
      });
      if (sejourClient) {
        await this.prisma.activiteClient.create({
          data: {
            clientId: sejourClient.clientId,
            centreId: devis.centreId,
            sejourId: devis.sejourDirect!.id,
            type: 'SIGNATURE',
            description: `Document signé uploadé — ${devis.sejourDirect!.titre}`,
            metadata: {
              devisId: devis.id,
              emailType: 'SIGNATURE_UPLOAD',
              to: devis.centre?.email ?? '',
              subject: `Document signé reçu — ${devis.sejourDirect!.titre}`,
              messagePreview: '',
            },
          },
        });
      }
    } catch { /* non bloquant */ }

    return { success: true, message: 'Document signé reçu' };
  }

  /** Annule un devis (statut → NON_RETENU). Bloque si une FA est émise sans avoir. */
  async annulerDevis(devisId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        sejourDirect: { select: { id: true } },
        demande: { select: { sejourId: true } },
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

    // Toute facture émise (acompte OU solde) doit être couverte par un avoir avant
    // l'annulation (flux 2 étapes conforme : émettre l'avoir, puis annuler).
    const facturesEmises = devis.factures.filter(
      (f) => f.typeFacture === 'ACOMPTE' || f.typeFacture === 'SOLDE',
    );
    for (const f of facturesEmises) {
      const avoir = await this.prisma.facture.findUnique({
        where: { factureAnnuleeId: f.id },
      });
      if (!avoir) {
        throw new ForbiddenException(
          'Une facture a été émise pour ce devis. Émettez d\'abord un avoir ' +
          'depuis l\'onglet Devis & Facturation avant d\'annuler.'
        );
      }
    }

    await this.prisma.devis.update({
      where: { id: devisId },
      data: { statut: StatutDevis.NON_RETENU },
    });

    // Transition séjour → OPTION s'il ne reste plus aucun devis actif (sélectionné
    // ou signé) sur le séjour (DIRECT ou COLLABORATIF). updateMany filtré pour ne
    // rétrograder que les statuts pilotés par le devis (pas DRAFT/OPTION/TAM/rectorat).
    const sejourCibleId = devis.sejourDirectId ?? devis.demande?.sejourId ?? null;
    if (sejourCibleId) {
      const autresActifs = await this.prisma.devis.count({
        where: {
          id: { not: devisId },
          isComplementaire: false, // les complémentaires ne pilotent pas le statut du séjour
          statut: { in: [StatutDevis.SELECTIONNE, StatutDevis.SIGNE_DIRECTION] },
          OR: [
            { sejourDirectId: sejourCibleId },
            { demande: { sejourId: sejourCibleId } },
          ],
        },
      });
      if (autresActifs === 0) {
        await this.prisma.sejour.updateMany({
          where: {
            id: sejourCibleId,
            statut: { in: [StatutSejour.SUBMITTED, StatutSejour.CONVENTION, StatutSejour.SIGNE_DIRECTION] },
          },
          data: { statut: StatutSejour.OPTION },
        });
      }
    }

    // Log CRM non bloquant
    try {
      if (sejourCibleId) {
        const sejourClient = await this.prisma.sejourClient.findFirst({
          where: { sejourId: sejourCibleId },
          select: { clientId: true },
        });
        if (sejourClient) {
          await this.prisma.activiteClient.create({
            data: {
              clientId: sejourClient.clientId,
              centreId: centre.id,
              sejourId: sejourCibleId,
              type: 'ANNULATION',
              description: `Devis ${devis.numeroDevis ?? devisId} annulé`,
              metadata: { devisId },
              userId,
            },
          });
        }
      }
    } catch { /* non bloquant */ }

    return { success: true };
  }
}
