import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateInvitationDto) {
    const invitation = await this.prisma.invitationHebergement.create({
      data: {
        email: dto.email,
        nomCentre: dto.nomCentre,
        centreExistantId:          dto.centreExistantId ?? null,
        centrePrecreerNom:         dto.centrePrecreerNom ?? null,
        centrePrecreerAdresse:     dto.centrePrecreerAdresse ?? null,
        centrePrecreerVille:       dto.centrePrecreerVille ?? null,
        centrePrecreerCodePostal:  dto.centrePrecreerCodePostal ?? null,
        centrePrecreerCapacite:    dto.centrePrecreerCapacite ?? null,
        centrePrecreerSiret:       dto.centrePrecreerSiret ?? null,
        centrePrecreerDepartement: dto.centrePrecreerDepartement ?? null,
      },
    });

    await this.envoyerEmail(invitation, dto.centrePrecreerNom ?? dto.nomCentre);

    return invitation;
  }

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token },
      include: {
        centreExistant: {
          select: { id: true, nom: true, ville: true, capacite: true, imageUrl: true },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.utilisedAt) throw new ConflictException('Cette invitation a déjà été utilisée');
    return invitation;
  }

  async getInvitations() {
    return this.prisma.invitationHebergement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        centreExistant: {
          select: { id: true, nom: true, ville: true },
        },
      },
    });
  }

  async renvoyer(id: string) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { id },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');

    const nouveauToken = randomUUID();
    const updated = await this.prisma.invitationHebergement.update({
      where: { id },
      data: {
        token: nouveauToken,
        utilisedAt: null,
        emailEnvoye: false,
        emailEnvoyeAt: null,
      },
    });

    await this.envoyerEmail(updated, updated.centrePrecreerNom ?? updated.nomCentre);

    return updated;
  }

  private async envoyerEmail(
    invitation: { id: string; email: string; token: string; centrePrecreerNom: string | null },
    centreLabel: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    const lien = `${frontendUrl}/register/hebergeur?token=${invitation.token}`;
    const precreer = invitation.centrePrecreerNom
      ? `<p style="color:#888;font-size:12px">Votre centre « ${invitation.centrePrecreerNom} » a été pré-configuré.</p>`
      : '';

    await this.email.sendGenericNotification(
      invitation.email,
      'Votre invitation à rejoindre LIAVO',
      `<p>Bonjour,</p>
       <p>Vous êtes invité(e) à rejoindre LIAVO pour gérer le centre <strong>${centreLabel}</strong>.</p>
       <p style="margin:24px 0">
         <a href="${lien}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">
           Créer mon compte →
         </a>
       </p>
       ${precreer}
       <p style="color:#888;font-size:12px">Ce lien est personnel et valable 30 jours.</p>`,
    );

    await this.prisma.invitationHebergement.update({
      where: { id: invitation.id },
      data: { emailEnvoye: true, emailEnvoyeAt: new Date() },
    });
  }
}
