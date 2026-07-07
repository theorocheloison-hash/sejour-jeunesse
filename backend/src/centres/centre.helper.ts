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

/**
 * Bloque tout envoi d'email vers un tiers tant que le centre n'est pas validé
 * par l'admin (statut !== 'ACTIVE'). Anti-phishing : un compte hébergeur est
 * utilisable immédiatement après inscription, sans contrôle humain — pendant
 * cette fenêtre PENDING, la plateforme ne doit pas servir à envoyer des emails
 * LIAVO (devis, conventions, invitations…) à des adresses arbitraires.
 * Exception : destinataire = l'adresse du compte qui déclenche l'envoi
 * (parcours de test onboarding, l'hébergeur s'envoie tout à lui-même).
 * À appeler AVANT tout emailService.* dans les flux déclenchés par HEBERGEUR.
 * userEmail doit venir de la base (JWT/userId), JAMAIS du body de la requête.
 */
export function assertEnvoiExterneAutorise(
  centre: { statut: string; nom: string },
  destinataireEmail: string | null | undefined,
  userEmail: string,
): void {
  if (centre.statut === 'ACTIVE') return;
  if (
    destinataireEmail &&
    destinataireEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()
  ) {
    return;
  }
  throw new ForbiddenException(
    `CENTRE_EN_VALIDATION|Votre centre est en cours de validation par l'équipe LIAVO. En attendant, vous pouvez tester tous les envois vers votre propre adresse email (${userEmail}).`,
  );
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

/**
 * Retourne les IDs de tous les centres accessibles par un user :
 * centres dont il est propriétaire + centres où il est collaborateur accepté.
 * Si centreId est fourni, vérifie l'accès à ce centre spécifique via getCentreForUser
 * (qui lève NotFoundException/ForbiddenException si non autorisé) et retourne [centreId].
 */
export async function getCentreIdsForUser(
  prisma: PrismaService,
  userId: string,
  centreId?: string | null,
): Promise<string[]> {
  if (centreId) {
    const centre = await getCentreForUser(prisma, userId, centreId);
    return [centre.id];
  }
  const owned = await prisma.centreHebergement.findMany({
    where: { userId, statut: 'ACTIVE' },
    select: { id: true },
  });
  const collabs = await prisma.collaborateurCentre.findMany({
    where: { userId, acceptedAt: { not: null }, centre: { statut: 'ACTIVE' } },
    select: { centreId: true },
  });
  const ids = new Set([
    ...owned.map((c) => c.id),
    ...collabs.map((c) => c.centreId),
  ]);
  return [...ids];
}
