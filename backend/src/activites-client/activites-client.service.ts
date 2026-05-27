import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

export type TypeActivite = 'APPEL' | 'EMAIL' | 'VISITE' | 'DEVIS' | 'SIGNATURE' | 'VERSEMENT' | 'NOTE' | 'BROCHURE';

export interface CreateActiviteDto {
  type: TypeActivite;
  description: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}

@Injectable()
export class ActivitesClientService {
  constructor(private prisma: PrismaService) {}

  async createActivite(clientId: string, centreId: string, dto: CreateActiviteDto) {
    return this.prisma.activiteClient.create({
      data: {
        clientId,
        centreId,
        type: dto.type,
        description: dto.description,
        metadata: (dto.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        userId: dto.userId ?? null,
      },
    });
  }

  async getActivites(clientId: string, centreId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client introuvable');
    if (client.centreId !== centreId) throw new ForbiddenException();
    return this.prisma.activiteClient.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createActiviteManuelle(clientId: string, userId: string, dto: CreateActiviteDto, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.centreId !== centre.id) throw new ForbiddenException();
    return this.createActivite(clientId, centre.id, { ...dto, userId });
  }

  async getActivitesForUser(clientId: string, userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);
    return this.getActivites(clientId, centre.id);
  }
}
