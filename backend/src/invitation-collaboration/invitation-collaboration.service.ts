import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateInvitationCollaborationDto } from './dto/create-invitation.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { assertEnvoiExterneAutorise, getCentreForUser } from '../centres/centre.helper.js';

@Injectable()
export class InvitationCollaborationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  /**
   * Lie un séjour au CRM hébergeur : cherche ou crée un Client,
   * crée SejourClient + ActiviteClient. Fire-and-forget, non bloquant.
   */
  private async linkSejourToCRM(params: {
    centreId: string;
    sejourId: string;
    sejourTitre: string;
    emailOrganisateur: string;
    etablissementNom?: string | null;
    etablissementUai?: string | null;
    etablissementVille?: string | null;
  }): Promise<void> {
    try {
      const { centreId, sejourId, sejourTitre, emailOrganisateur, etablissementNom, etablissementUai, etablissementVille } = params;

      let client = await this.prisma.client.findFirst({
        where: { centreId, email: emailOrganisateur },
      });

      if (!client && etablissementUai) {
        client = await this.prisma.client.findFirst({
          where: { centreId, uai: etablissementUai },
        });
      }

      if (!client && etablissementNom) {
        client = await this.prisma.client.findFirst({
          where: { centreId, nom: etablissementNom },
        });
      }

      if (!client) {
        client = await this.prisma.client.create({
          data: {
            centreId,
            nom: etablissementNom || emailOrganisateur,
            type: 'ETABLISSEMENT_SCOLAIRE',
            statut: 'CLIENT',
            email: emailOrganisateur,
            uai: etablissementUai ?? undefined,
            ville: etablissementVille ?? undefined,
            source: 'INVITATION',
          },
        });
      } else {
        if (!client.email && emailOrganisateur) {
          await this.prisma.client.update({
            where: { id: client.id },
            data: { email: emailOrganisateur },
          });
        }
        if (client.statut === 'PROSPECT') {
          await this.prisma.client.update({
            where: { id: client.id },
            data: { statut: 'CLIENT' },
          });
        }
      }

      await this.prisma.sejourClient.upsert({
        where: {
          clientId_sejourId: { clientId: client.id, sejourId },
        },
        update: {},
        create: { clientId: client.id, sejourId },
      });

      await this.prisma.activiteClient.create({
        data: {
          clientId: client.id,
          centreId,
          type: 'NOTE',
          description: `Séjour "${sejourTitre}" créé via invitation collaborative`,
        },
      });
    } catch (err) {
      console.error('[CRM linkSejourToCRM] Erreur non bloquante:', err);
    }
  }

  async create(dto: CreateInvitationCollaborationDto, user: JwtUser, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, user.id, centreId);

    // Centre non validé (PENDING) : envoi externe interdit, sauf vers sa propre
    // adresse (test onboarding). Gate posé AVANT la création de l'invitation pour
    // ne pas laisser un token orphelin. Email du user rechargé depuis la base.
    if (centre.statut !== 'ACTIVE') {
      const me = await this.prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });
      assertEnvoiExterneAutorise(centre, dto.emailEnseignant, me?.email ?? '');
    }

    const invitation = await this.prisma.invitationCollaboration.create({
      data: {
        centreId: centre.id,
        emailEnseignant: dto.emailEnseignant,
        titreSejourSuggere: dto.titreSejourSuggere,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nbElevesEstime: dto.nbElevesEstime,
        message: dto.message ?? null,
        niveauClasse: dto.niveauClasse ?? null,
        nombreAccompagnateurs: dto.nombreAccompagnateurs ?? null,
        thematiquesPedagogiques: dto.thematiquesPedagogiques ?? [],
        heureArrivee: dto.heureArrivee ?? null,
        heureDepart: dto.heureDepart ?? null,
        transportAller: dto.transportAller ?? null,
        transportSurPlace: dto.transportSurPlace ?? null,
        activitesSouhaitees: dto.activitesSouhaitees ?? null,
        budgetMaxParEleve: dto.budgetMaxParEleve ?? null,
        etablissementUai: dto.etablissementUai ?? null,
        etablissementNom: dto.etablissementNom ?? null,
        etablissementAdresse: dto.etablissementAdresse ?? null,
        etablissementVille: dto.etablissementVille ?? null,
        devisDraftJson: dto.devisDraftJson ?? undefined,
      },
    });

    const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
    const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/rejoindre/${invitation.token}`;

    const msgPart = dto.message
      ? `<p style="margin:12px 0;padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>`
      : '';

    await this.email.sendGenericNotification(
      dto.emailEnseignant,
      `${centre.nom} vous invite à collaborer sur un séjour`,
      `<p><strong>${centre.nom}</strong> souhaite organiser un séjour avec vous :</p>
       <p><strong>Séjour :</strong> ${dto.titreSejourSuggere}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Nombre d'élèves estimé :</strong> ${dto.nbElevesEstime}</p>
       ${msgPart}
       <p>Pour accepter cette invitation et démarrer la collaboration, cliquez sur le bouton ci-dessous.</p>
       <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Accepter l'invitation</a></p>
       <p style="color:#888;font-size:12px">Vous n'avez pas encore de compte LIAVO ? Créez-en un gratuitement en cliquant sur le lien ci-dessus.</p>`,
    );

    return { id: invitation.id, token: invitation.token };
  }

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationCollaboration.findUnique({
      where: { token },
      include: {
        centre: {
          select: { nom: true, ville: true, adresse: true, userId: true },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Cette invitation a déjà été acceptée');
    return invitation;
  }

  async accepter(token: string, user: JwtUser) {
    const invitation = await this.prisma.invitationCollaboration.findUnique({
      where: { token },
      include: { centre: true },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Cette invitation a déjà été acceptée');

    const result = await this.prisma.$transaction(async (tx) => {
      // ── Si l'invitation est liée à un séjour DIRECT existant → rattacher au lieu de créer ──
      if (invitation.sejourId) {
        const existingSejour = await tx.sejour.findUnique({
          where: { id: invitation.sejourId },
          select: { id: true, modeGestion: true, createurId: true },
        });
        if (existingSejour && existingSejour.modeGestion === 'DIRECT' && !existingSejour.createurId) {
          // 1. Rattacher l'enseignant + passer en COLLABORATIF + CONVENTION
          await tx.sejour.update({
            where: { id: existingSejour.id },
            data: {
              createurId: user.id,
              modeGestion: 'COLLABORATIF',
              statut: 'CONVENTION',
            },
          });

          // 2. Auto-sélectionner le devis DIRECT s'il existe
          const devisDirect = await tx.devis.findFirst({
            where: { sejourDirectId: existingSejour.id },
            orderBy: { createdAt: 'desc' },
          });

          if (devisDirect) {
            if (devisDirect.statut === 'EN_ATTENTE') {
              await tx.devis.update({
                where: { id: devisDirect.id },
                data: { statut: 'SELECTIONNE' },
              });
            }

            // 3. Créer une DemandeDevis pont pour que le frontend organisateur
            //    trouve le devis via sejour.demandes[].devis[]
            const sejourData = await tx.sejour.findUnique({
              where: { id: existingSejour.id },
              select: { titre: true, dateDebut: true, dateFin: true, placesTotales: true, lieu: true },
            });

            const demande = await tx.demandeDevis.create({
              data: {
                sejourId: existingSejour.id,
                enseignantId: user.id,
                titre: sejourData?.titre ?? invitation.titreSejourSuggere,
                dateDebut: sejourData?.dateDebut ?? invitation.dateDebut,
                dateFin: sejourData?.dateFin ?? invitation.dateFin,
                nombreEleves: sejourData?.placesTotales ?? invitation.nbElevesEstime,
                villeHebergement: sejourData?.lieu ?? '',
                statut: 'FERMEE',
                typePension: [],
                centreDestinataireId: devisDirect.centreId,
              },
            });

            // 4. Rattacher le devis à la demande
            await tx.devis.update({
              where: { id: devisDirect.id },
              data: { demandeId: demande.id },
            });
          }

          await tx.invitationCollaboration.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date(), sejourId: existingSejour.id },
          });

          return { sejourId: existingSejour.id, devisCree: devisDirect ?? null };
        }
      }

      // Séjour en DRAFT sans hébergeur lié — l'enseignant doit choisir via le workflow devis normal
      const sejour = await tx.sejour.create({
        data: {
          titre: invitation.titreSejourSuggere,
          lieu: invitation.centre.ville,
          dateDebut: invitation.dateDebut,
          dateFin: invitation.dateFin,
          placesTotales: invitation.nbElevesEstime,
          placesRestantes: invitation.nbElevesEstime,
          statut: 'DRAFT',
          createurId: user.id,
          // Pas de hebergementSelectionneId — l'hébergeur doit soumettre un devis
          regionSouhaitee: `VILLE:${invitation.centre.ville}`,
          niveauClasse: invitation.niveauClasse ?? null,
          thematiquesPedagogiques: invitation.thematiquesPedagogiques ?? [],
          nombreAccompagnateurs: invitation.nombreAccompagnateurs ?? null,
          heureArrivee: invitation.heureArrivee ?? null,
          heureDepart: invitation.heureDepart ?? null,
          transportAller: invitation.transportAller ?? null,
          transportSurPlace: invitation.transportSurPlace ?? null,
          activitesSouhaitees: invitation.activitesSouhaitees ?? null,
          budgetMaxParEleve: invitation.budgetMaxParEleve ?? null,
        },
      });

      // Demande de devis OUVERTE — visible dans les demandes reçues de l'hébergeur
      const demande = await tx.demandeDevis.create({
        data: {
          sejourId: sejour.id,
          enseignantId: user.id,
          titre: invitation.titreSejourSuggere,
          dateDebut: invitation.dateDebut,
          dateFin: invitation.dateFin,
          nombreEleves: invitation.nbElevesEstime,
          villeHebergement: invitation.centre.ville,
          statut: 'OUVERTE',
          typePension: [],
          centreDestinataireId: invitation.centreId,
          nombreAccompagnateurs: invitation.nombreAccompagnateurs ?? null,
          heureArrivee: invitation.heureArrivee ?? null,
          heureDepart: invitation.heureDepart ?? null,
          activitesSouhaitees: invitation.activitesSouhaitees ?? null,
          budgetMaxParEleve: invitation.budgetMaxParEleve ?? null,
          transportAller: invitation.transportAller ?? null,
          transportSurPlace: invitation.transportSurPlace ?? null,
        },
      });

      // Création du devis pré-rempli si l'hébergeur l'a préparé
      let devisCree: { id: string } | null = null;
      if (invitation.devisDraftJson && invitation.centreId) {
        const draft = invitation.devisDraftJson as {
          description?: string;
          conditionsAnnulation?: string;
          nomEntreprise?: string;
          adresseEntreprise?: string;
          siretEntreprise?: string;
          emailEntreprise?: string;
          telEntreprise?: string;
          tauxTva?: number;
          montantHT?: number;
          montantTVA?: number;
          montantTTC?: number;
          pourcentageAcompte?: number;
          montantAcompte?: number;
          lignes?: Array<{
            description: string;
            quantite: number;
            prixUnitaire: number;
            tva: number;
            totalHT: number;
            totalTTC: number;
          }>;
        };

        // Générer le numéro de devis inline (pas d'appel à DevisService)
        const year = new Date().getFullYear();
        const countDevis = await tx.devis.count({
          where: {
            centreId: invitation.centreId,
            createdAt: {
              gte: new Date(`${year}-01-01`),
              lt: new Date(`${year + 1}-01-01`),
            },
          },
        });
        const numeroDevis = `DEV-${year}-${String(countDevis + 1).padStart(3, '0')}`;

        const montantTTC = draft.montantTTC ?? 0;
        const nbEleves = Math.max(1, invitation.nbElevesEstime);
        const montantParEleve = montantTTC / nbEleves;

        const nouveauDevis = await tx.devis.create({
          data: {
            demandeId: demande.id,
            centreId: invitation.centreId,
            montantTotal: String(montantTTC),
            montantParEleve: String(montantParEleve),
            description: draft.description ?? null,
            conditionsAnnulation: draft.conditionsAnnulation ?? null,
            nomEntreprise: draft.nomEntreprise ?? null,
            adresseEntreprise: draft.adresseEntreprise ?? null,
            siretEntreprise: draft.siretEntreprise ?? null,
            emailEntreprise: draft.emailEntreprise ?? null,
            telEntreprise: draft.telEntreprise ?? null,
            tauxTva: draft.tauxTva ?? 0,
            montantHT: draft.montantHT ?? null,
            montantTVA: draft.montantTVA ?? null,
            montantTTC: montantTTC,
            pourcentageAcompte: draft.pourcentageAcompte ?? 30,
            montantAcompte: draft.montantAcompte ?? null,
            numeroDevis,
            typeDevis: 'INVITATION',
            statut: 'EN_ATTENTE',
          },
        });

        if (draft.lignes && draft.lignes.length > 0) {
          await tx.ligneDevis.createMany({
            data: draft.lignes.map(l => ({
              devisId: nouveauDevis.id,
              description: l.description,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              tva: l.tva ?? 0,
              totalHT: l.totalHT,
              totalTTC: l.totalTTC,
            })),
          });
        }

        devisCree = nouveauDevis;
      }

      await tx.invitationCollaboration.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), sejourId: sejour.id },
      });

      return { sejourId: sejour.id, devisCree };
    });

    // ── Liaison CRM (non bloquant) ──
    this.linkSejourToCRM({
      centreId: invitation.centreId,
      sejourId: result.sejourId,
      sejourTitre: invitation.titreSejourSuggere,
      emailOrganisateur: invitation.emailEnseignant,
      etablissementNom: invitation.etablissementNom,
      etablissementUai: invitation.etablissementUai,
      etablissementVille: invitation.etablissementVille,
    }).catch(() => {});

    // Notifier l'hébergeur qu'une demande l'attend
    const centreUser = await this.prisma.user.findUnique({
      where: { id: invitation.centre.userId! },
      select: { email: true },
    });
    if (centreUser) {
      const dateDebut = new Date(invitation.dateDebut).toLocaleDateString('fr-FR');
      const dateFin = new Date(invitation.dateFin).toLocaleDateString('fr-FR');
      const devisInfo = result.devisCree
        ? `<p>Votre devis pré-rempli a été automatiquement soumis à l'enseignant.</p>`
        : `<p>Une demande de devis vous attend dans votre espace.</p>
           <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/hebergeur/demandes" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mes demandes</a></p>`;

      await this.email.sendGenericNotification(
        centreUser.email,
        `L'enseignant a accepté votre invitation — ${invitation.titreSejourSuggere}`,
        `<p>L'enseignant que vous avez invité a accepté votre invitation pour le séjour <strong>${invitation.titreSejourSuggere}</strong>.</p>
         <p><strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Élèves :</strong> ${invitation.nbElevesEstime}</p>
         ${devisInfo}`,
      );
    }

    return result;
  }

  async inviterCentreExterne(dto: {
    emailDestinataire: string;
    nomCentre: string;
    villeCentre: string;
    codePostalCentre: string;
    titreSejourSuggere: string;
    dateDebut: string;
    dateFin: string;
    nbElevesEstime: number;
    message?: string;
  }, enseignantId: string) {
    // Stocker l'invitation en DB
    const invitation = await this.prisma.invitationCentreExterne.create({
      data: {
        enseignantId,
        emailDestinataire: dto.emailDestinataire,
        nomCentre: dto.nomCentre,
        villeCentre: dto.villeCentre,
        codePostalCentre: dto.codePostalCentre,
        titreSejourSuggere: dto.titreSejourSuggere,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nbElevesEstime: dto.nbElevesEstime,
        message: dto.message ?? null,
      },
    });

    // Lien avec token pour relier l'inscription au retour
    const params = new URLSearchParams({
      nomCentre: dto.nomCentre,
      ville: dto.villeCentre,
      codePostal: dto.codePostalCentre,
      invitationToken: invitation.token,
    });
    const lien = `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/register/hebergeur?${params.toString()}`;

    const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
    const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
    const msgPart = dto.message
      ? `<p style="margin:12px 0;padding:12px;background:#f5f4f1;border-radius:8px;font-style:italic">${dto.message}</p>`
      : '';

    await this.email.sendGenericNotification(
      dto.emailDestinataire,
      `Un enseignant souhaite collaborer avec ${dto.nomCentre} via LIAVO`,
      `<p>Un enseignant souhaite organiser un séjour avec votre structure :</p>
       <p><strong>Séjour :</strong> ${dto.titreSejourSuggere}<br>
       <strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
       <strong>Nombre d'élèves :</strong> ${dto.nbElevesEstime}</p>
       ${msgPart}
       <p>Pour répondre à cette demande, créez votre compte gratuitement sur LIAVO. Vos informations seront pré-remplies automatiquement.</p>
       <p style="margin:24px 0"><a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Créer mon compte LIAVO</a></p>
       <p style="color:#888;font-size:12px">Une fois votre compte validé par notre équipe, vous pourrez soumettre votre devis à cet enseignant.</p>`,
    );

    return { sent: true, token: invitation.token };
  }
}
