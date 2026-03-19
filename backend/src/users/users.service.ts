import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateEtablissementDto } from './dto/update-etablissement.dto.js';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        prenom: true,
        nom: true,
        email: true,
        telephone: true,
        role: true,
        etablissementUai: true,
        etablissementNom: true,
        etablissementAdresse: true,
        etablissementVille: true,
        etablissementEmail: true,
        etablissementTelephone: true,
        emailRectorat: true,
      },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    return user;
  }

  async updateProfil(userId: string, data: { emailRectorat?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailRectorat: data.emailRectorat ?? null },
      select: {
        id: true,
        emailRectorat: true,
      },
    });
  }

  async updateEtablissement(userId: string, dto: UpdateEtablissementDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        etablissementUai: dto.etablissementUai,
        etablissementNom: dto.etablissementNom,
        etablissementAdresse: dto.etablissementAdresse ?? null,
        etablissementVille: dto.etablissementVille ?? null,
        etablissementEmail: dto.etablissementEmail ?? null,
        etablissementTelephone: dto.etablissementTelephone ?? null,
      },
      select: {
        id: true,
        etablissementUai: true,
        etablissementNom: true,
        etablissementAdresse: true,
        etablissementVille: true,
        etablissementEmail: true,
        etablissementTelephone: true,
      },
    });
  }
}
