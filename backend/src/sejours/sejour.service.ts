import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role, StatutSejour } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSejourDto } from './dto/create-sejour.dto.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';

@Injectable()
export class SejourService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSejourDto, createurId: string) {
    return this.prisma.sejour.create({
      data: {
        titre:          dto.titre,
        description:    dto.description,
        lieu:           dto.villeHebergement,
        dateDebut:      new Date(dto.dateDebut),
        dateFin:        new Date(dto.dateFin),
        placesTotales:  dto.nombreEleves,
        placesRestantes: dto.nombreEleves,
        createurId,
      },
    });
  }

  async getMesSejours(createurId: string) {
    return this.prisma.sejour.findMany({
      where:   { createurId },
      orderBy: { dateDebut: 'asc' },
    });
  }

  async findAll() {
    return this.prisma.sejour.findMany({
      orderBy: { dateDebut: 'asc' },
    });
  }

  async updateStatus(id: string, statut: StatutSejour, user: JwtUser) {
    const sejour = await this.prisma.sejour.findUnique({ where: { id } });
    if (!sejour) throw new NotFoundException('Séjour introuvable');

    if (user.role === Role.TEACHER) {
      if (sejour.createurId !== user.id)
        throw new ForbiddenException('Ce séjour ne vous appartient pas');
      if (statut !== StatutSejour.SUBMITTED)
        throw new ForbiddenException('Les enseignants peuvent uniquement soumettre un séjour');
    }

    return this.prisma.sejour.update({
      where: { id },
      data:  { statut },
    });
  }
}
