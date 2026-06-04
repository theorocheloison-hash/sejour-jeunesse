import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export async function getCentreForUser(
  prisma: PrismaService,
  userId: string,
  centreId?: string | null,
) {
  if (centreId) {
    const centre = await prisma.centreHebergement.findUnique({ where: { id: centreId } });
    // Sécurité : un centre PENDING (non validé par l'admin) n'est pas opérable.
    // On renvoie 404 (et non 403) pour ne pas distinguer inexistant / non validé.
    if (!centre || centre.statut !== 'ACTIVE') throw new NotFoundException('Centre introuvable');
    if (centre.userId !== userId) throw new ForbiddenException('Ce centre ne vous appartient pas');
    return centre;
  }
  const centre = await prisma.centreHebergement.findFirst({ where: { userId, statut: 'ACTIVE' } });
  if (!centre) throw new NotFoundException('Centre introuvable');
  return centre;
}

export async function getCentresForUser(prisma: PrismaService, userId: string) {
  return prisma.centreHebergement.findMany({ where: { userId, statut: 'ACTIVE' } });
}
