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

    // Propriétaire → OK
    if (centre.userId === userId) return centre;

    // Collaborateur accepté → OK
    const collab = await prisma.collaborateurCentre.findFirst({
      where: { centreId, userId, acceptedAt: { not: null } },
    });
    if (collab) return centre;

    throw new ForbiddenException('Ce centre ne vous appartient pas');
  }

  // Sans centreId : chercher d'abord en propriétaire, puis en collaborateur
  const ownCentre = await prisma.centreHebergement.findFirst({
    where: { userId, statut: 'ACTIVE' },
  });
  if (ownCentre) return ownCentre;

  // Fallback : premier centre où l'user est collaborateur accepté
  const collab = await prisma.collaborateurCentre.findFirst({
    where: { userId, acceptedAt: { not: null }, centre: { statut: 'ACTIVE' } },
    include: { centre: true },
  });
  if (collab) return collab.centre;

  throw new NotFoundException('Centre introuvable');
}

export async function getCentresForUser(prisma: PrismaService, userId: string) {
  const owned = await prisma.centreHebergement.findMany({
    where: { userId, statut: 'ACTIVE' },
  });
  const collabCentres = await prisma.collaborateurCentre.findMany({
    where: { userId, acceptedAt: { not: null }, centre: { statut: 'ACTIVE' } },
    include: { centre: true },
  });
  const collabIds = new Set(owned.map(c => c.id));
  const fromCollab = collabCentres
    .filter(cc => !collabIds.has(cc.centreId))
    .map(cc => cc.centre);
  return [...owned, ...fromCollab];
}
