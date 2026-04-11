import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class InvitationsDirecteurService {
  constructor(private prisma: PrismaService) {}

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationDirecteur.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable ou expirée');
    return {
      etablissementUai: invitation.etablissementUai,
      etablissementNom: invitation.etablissementNom,
      sejourTitre: invitation.sejourTitre,
      enseignantPrenom: invitation.enseignantPrenom,
    };
  }

  async marquerUtilisee(token: string) {
    await this.prisma.invitationDirecteur.updateMany({
      where: { token, utilisedAt: null },
      data: { utilisedAt: new Date() },
    });
  }
}
