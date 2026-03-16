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

@Injectable()
export class InvitationCollaborationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateInvitationCollaborationDto, user: JwtUser) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId: user.id },
    });
    if (!centre) throw new ForbiddenException('Aucun centre associé à votre compte');

    const invitation = await this.prisma.invitationCollaboration.create({
      data: {
        centreId: centre.id,
        emailEnseignant: dto.emailEnseignant,
        titreSejourSuggere: dto.titreSejourSuggere,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nbElevesEstime: dto.nbElevesEstime,
        message: dto.message ?? null,
      },
    });

    const dateDebut = new Date(dto.dateDebut).toLocaleDateString('fr-FR');
    const dateFin = new Date(dto.dateFin).toLocaleDateString('fr-FR');
    const lien = `https://precious-comfort-production-52c6.up.railway.app/rejoindre/${invitation.token}`;

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
          select: { nom: true, ville: true, adresse: true },
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
      const sejour = await tx.sejour.create({
        data: {
          titre: invitation.titreSejourSuggere,
          lieu: invitation.centre.ville,
          dateDebut: invitation.dateDebut,
          dateFin: invitation.dateFin,
          placesTotales: invitation.nbElevesEstime,
          placesRestantes: invitation.nbElevesEstime,
          statut: 'CONVENTION',
          createurId: user.id,
          hebergementSelectionneId: invitation.centreId,
          regionSouhaitee: `VILLE:${invitation.centre.ville}`,
        },
      });

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
        },
      });

      await tx.devis.create({
        data: {
          demandeId: demande.id,
          centreId: invitation.centreId,
          montantTotal: 0,
          montantParEleve: 0,
          statut: 'SELECTIONNE',
          typeDevis: 'PLATEFORME',
          typeDocument: 'DEVIS',
        },
      });

      await tx.invitationCollaboration.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date(), sejourId: sejour.id },
      });

      return { sejourId: sejour.id };
    });

    return result;
  }
}
