import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

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

  /**
   * Invitations collaboratives pendantes pour l'organisateur connecté (bannière
   * dashboard). Email rechargé depuis la base (jamais celui du JWT), match
   * insensible à la casse, invitations expirées (dateFin passée) exclues.
   */
  async getPendantesPourUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const email = user?.email?.trim();
    if (!email) return [];

    const aujourdHui = new Date();
    aujourdHui.setUTCHours(0, 0, 0, 0);

    const invitations = await this.prisma.invitationCollaboration.findMany({
      where: {
        acceptedAt: null,
        dateFin: { gte: aujourdHui },
        emailEnseignant: { equals: email, mode: 'insensitive' },
      },
      select: {
        token: true,
        titreSejourSuggere: true,
        dateDebut: true,
        dateFin: true,
        nbElevesEstime: true,
        sejourId: true,
        centre: { select: { nom: true, ville: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Pas de relation Prisma InvitationCollaboration→Sejour : le filtre
    // « séjour encore rattachable » (DIRECT, sans créateur, non supprimé)
    // se fait en code sur une seconde requête.
    const sejourIds = invitations
      .map((inv) => inv.sejourId)
      .filter((id): id is string => id !== null);
    const sejoursById = new Map<
      string,
      { modeGestion: string; createurId: string | null; deletedAt: Date | null }
    >();
    if (sejourIds.length > 0) {
      const sejours = await this.prisma.sejour.findMany({
        where: { id: { in: sejourIds } },
        select: { id: true, modeGestion: true, createurId: true, deletedAt: true },
      });
      for (const s of sejours) sejoursById.set(s.id, s);
    }

    return invitations
      .filter((inv) => {
        if (!inv.sejourId) return true;
        const sejour = sejoursById.get(inv.sejourId);
        return !!sejour && sejour.modeGestion === 'DIRECT' && !sejour.createurId && !sejour.deletedAt;
      })
      .map((inv) => ({
        token: inv.token,
        titreSejourSuggere: inv.titreSejourSuggere,
        dateDebut: inv.dateDebut,
        dateFin: inv.dateFin,
        nbElevesEstime: inv.nbElevesEstime,
        centre: inv.centre,
      }));
  }

  async accepter(token: string, user: Pick<JwtUser, 'id' | 'email'>) {
    const invitation = await this.prisma.invitationCollaboration.findUnique({
      where: { token },
      include: { centre: true },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.acceptedAt) throw new ConflictException('Cette invitation a déjà été acceptée');

    if (user.email.trim().toLowerCase() !== invitation.emailEnseignant.trim().toLowerCase()) {
      throw new ForbiddenException(
        `Cette invitation a été envoyée à ${invitation.emailEnseignant}. ` +
        `Connectez-vous ou créez votre compte avec cette adresse pour rejoindre le séjour.`
      );
    }

    // Rejoindre ≠ signer : l'invitation DOIT porter un séjour DIRECT rattachable.
    // Toutes les conditions d'éligibilité sont des gardes AVANT la transaction ;
    // plus aucun chemin ne crée de séjour ici.
    if (!invitation.sejourId) {
      throw new BadRequestException('Invitation invalide : aucun séjour associé');
    }
    const existingSejour = await this.prisma.sejour.findUnique({
      where: { id: invitation.sejourId },
      select: { id: true, modeGestion: true, createurId: true, deletedAt: true },
    });
    if (!existingSejour || existingSejour.deletedAt) {
      throw new NotFoundException('Séjour introuvable ou supprimé');
    }
    if (existingSejour.modeGestion !== 'DIRECT' || existingSejour.createurId) {
      throw new ConflictException('Ce séjour a déjà été rejoint');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Rattacher l'enseignant + passer en COLLABORATIF. Le séjour reste OPTION et
      // le devis EN_ATTENTE : la valeur contractuelle vient de la signature, pas du
      // clic « Rejoindre ».
      await tx.sejour.update({
        where: { id: existingSejour.id },
        data: {
          createurId: user.id,
          modeGestion: 'COLLABORATIF',
        },
      });

      // Devis DIRECT existant → DemandeDevis pont pour que le frontend organisateur
      // trouve le devis via sejour.demandes[].devis[]. Le devis n'est PAS
      // auto-sélectionné : il reste EN_ATTENTE, signable depuis l'espace connecté.
      const devisDirect = await tx.devis.findFirst({
        where: { sejourDirectId: existingSejour.id },
        orderBy: { createdAt: 'desc' },
      });

      if (devisDirect) {
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

        // Rattacher le devis à la demande pont
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
        ? `<p>Le devis est en attente de la signature de l'enseignant depuis son espace.</p>`
        : `<p>Aucun devis n'est encore associé à ce séjour.</p>`;

      await this.email.sendGenericNotification(
        centreUser.email,
        `L'enseignant a rejoint le séjour — ${invitation.titreSejourSuggere}`,
        `<p>L'enseignant que vous avez invité a accepté votre invitation pour le séjour <strong>${invitation.titreSejourSuggere}</strong>.</p>
         <p><strong>Dates :</strong> ${dateDebut} → ${dateFin}<br>
         <strong>Élèves :</strong> ${invitation.nbElevesEstime}</p>
         ${devisInfo}`,
        undefined,
        undefined,
        null,
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
      undefined,
      undefined,
      null,
    );

    return { sent: true, token: invitation.token };
  }
}
