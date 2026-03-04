import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

@Injectable()
export class InvitationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInvitationDto) {
    const invitation = await this.prisma.invitationHebergement.create({
      data: {
        email: dto.email,
        nomCentre: dto.nomCentre,
      },
    });
    return invitation;
  }

  async findByToken(token: string) {
    const invitation = await this.prisma.invitationHebergement.findUnique({
      where: { token },
    });
    if (!invitation) throw new NotFoundException('Invitation introuvable');
    if (invitation.utilisedAt) throw new ConflictException('Cette invitation a déjà été utilisée');
    return invitation;
  }
}
