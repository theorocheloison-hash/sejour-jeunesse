import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchHebergementDto } from './dto/search-hebergement.dto.js';

@Injectable()
export class HebergementService {
  constructor(private prisma: PrismaService) {}

  async search(dto: SearchHebergementDto) {
    const where: Record<string, unknown> = { sejourId: null };

    if (dto.ville) {
      where.ville = { contains: dto.ville, mode: 'insensitive' };
    }
    if (dto.capaciteMin != null || dto.capaciteMax != null) {
      const capacite: Record<string, number> = {};
      if (dto.capaciteMin != null) capacite.gte = dto.capaciteMin;
      if (dto.capaciteMax != null) capacite.lte = dto.capaciteMax;
      where.capacite = capacite;
    }
    if (dto.prixMax != null) {
      where.prixParJour = { lte: dto.prixMax };
    }
    if (dto.agrement != null) {
      where.agrement = dto.agrement;
    }

    return this.prisma.hebergement.findMany({
      where,
      orderBy: { nom: 'asc' },
    });
  }

  async findById(id: string) {
    const hebergement = await this.prisma.hebergement.findUnique({ where: { id } });
    if (!hebergement) throw new NotFoundException('Hébergement introuvable');
    return hebergement;
  }
}
