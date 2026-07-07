import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export async function getCentreForUser(
  prisma: PrismaService,
  userId: string,
  centreId?: string | null,
) {
  if (centreId) {
    const centre = await prisma.centreHebergement.findUnique({ where: { id: centreId } });
    // SUSPENDED = kill switch : 404 pour tout le monde, propriétaire compris.
    // 404 (et non 403) pour ne pas distinguer inexistant / suspendu.
    if (!centre || centre.statut === 'SUSPENDED') throw new NotFoundException('Centre introuvable');

    // Un centre PENDING est opérable par son propriétaire et ses collaborateurs
    // acceptés : la frontière de sécurité n'est plus l'accès au centre mais les
    // gates d'envoi (assertEnvoiExterneAutorise) — le catalogue public filtre
    // statut ACTIVE par ses propres requêtes, indépendamment de ce helper.
    // L'appartenance est vérifiée AVANT de révéler quoi que ce soit.
    if (centre.userId === userId) return centre;

    const collab = await prisma.collaborateurCentre.findFirst({
      where: { centreId, userId, acceptedAt: { not: null } },
    });
    if (collab) return centre;

    // Tiers : un centre PENDING ne doit pas être sondable par ID → 404.
    // Centre ACTIVE : 403 conservé (comportement historique attendu des appelants).
    if (centre.statut !== 'ACTIVE') throw new NotFoundException('Centre introuvable');
    throw new ForbiddenException('Ce centre ne vous appartient pas');
  }

  // Sans centreId : chercher d'abord en propriétaire, puis en collaborateur.
  // PENDING inclus (opérable) — seul SUSPENDED est exclu.
  const ownCentre = await prisma.centreHebergement.findFirst({
    where: { userId, statut: { not: 'SUSPENDED' } },
  });
  if (ownCentre) return ownCentre;

  // Fallback : premier centre où l'user est collaborateur accepté
  const collab = await prisma.collaborateurCentre.findFirst({
    where: { userId, acceptedAt: { not: null }, centre: { statut: { not: 'SUSPENDED' } } },
    include: { centre: true },
  });
  if (collab) return collab.centre;

  throw new NotFoundException('Centre introuvable');
}

/**
 * Bloque tout envoi d'email vers un tiers tant que la validation admin n'est
 * pas acquise. Anti-phishing : un compte hébergeur est utilisable immédiatement
 * après inscription (ou revendication), sans contrôle humain — pendant cette
 * fenêtre, la plateforme ne doit pas servir à envoyer des emails LIAVO
 * (devis, conventions, invitations…) à des adresses arbitraires.
 *
 * Deux fenêtres de blocage, dans cet ordre :
 *   - centre.statut !== 'ACTIVE' (inscription ex-nihilo, centre PENDING) ;
 *   - centre ACTIVE mais revendication du PROPRIÉTAIRE (centre.userId) non
 *     validée : Membership {userId, organisationId} avec claimStatut
 *     EN_ATTENTE_DOCUMENT / EN_ATTENTE_VALIDATION / REFUSE. C'est le chemin
 *     CLAIM : les centres catalogue sont déjà ACTIVE, la validation porte
 *     sur l'utilisateur, pas sur le centre.
 *   NON_APPLICABLE ne bloque pas : ce sont les comptes historiques créés par
 *   l'admin, jamais un claim en attente ; les 5 clients prod sont VALIDE
 *   (vérifié en base le 07/07). Membership absent ou centre sans organisation
 *   (legacy) → pas de blocage.
 *
 * Exception (prioritaire sur tout) : destinataire = l'adresse du compte qui
 * déclenche l'envoi (parcours de test onboarding, l'hébergeur s'envoie tout
 * à lui-même).
 * La requête membership ne s'exécute que sur le chemin bloquant potentiel
 * (centre ACTIVE + destinataire ≠ self) : un findUnique sur clé composite
 * indexée, y compris pour les clients validés. Pas de cache (une validation
 * admin doit débloquer immédiatement).
 * À appeler AVANT tout emailService.* dans les flux déclenchés par HEBERGEUR.
 * userEmail doit venir de la base (JWT/userId), JAMAIS du body de la requête.
 * Les notifications de l'espace collaboratif (collaboration.service) ne sont
 * pas gatées : un séjour COLLAB actif implique un organisateur lié via une
 * demande acceptée du temps où le centre était ACTIVE ; destinataire fixe,
 * jamais d'adresse libre.
 */
export async function assertEnvoiExterneAutorise(
  prisma: PrismaService,
  centre: { statut: string; nom: string; organisationId: string | null; userId: string | null },
  destinataireEmail: string | null | undefined,
  userEmail: string,
): Promise<void> {
  // 1. Auto-envoi (test onboarding) — toujours permis.
  if (
    destinataireEmail &&
    destinataireEmail.trim().toLowerCase() === userEmail.trim().toLowerCase()
  ) {
    return;
  }

  // 2. Centre non validé (PENDING) — inscription ex-nihilo.
  if (centre.statut !== 'ACTIVE') {
    throw new ForbiddenException(
      `CENTRE_EN_VALIDATION|Votre centre est en cours de validation par l'équipe LIAVO. En attendant, vous pouvez tester tous les envois vers votre propre adresse email (${userEmail}).`,
    );
  }

  // 3. Centre ACTIVE : la revendication du propriétaire doit être validée.
  if (centre.organisationId && centre.userId) {
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organisationId: {
          userId: centre.userId,
          organisationId: centre.organisationId,
        },
      },
      select: { claimStatut: true },
    });
    if (
      membership &&
      ['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'].includes(membership.claimStatut)
    ) {
      throw new ForbiddenException(
        `CENTRE_EN_VALIDATION|Votre revendication du centre est en cours de validation par l'équipe LIAVO. En attendant, vous pouvez tester tous les envois vers votre propre adresse email (${userEmail}).`,
      );
    }
  }
}

export async function getCentresForUser(prisma: PrismaService, userId: string) {
  // PENDING inclus (centre opérable par son propriétaire) — seul SUSPENDED est exclu.
  const owned = await prisma.centreHebergement.findMany({
    where: { userId, statut: { not: 'SUSPENDED' } },
  });
  const collabCentres = await prisma.collaborateurCentre.findMany({
    where: { userId, acceptedAt: { not: null }, centre: { statut: { not: 'SUSPENDED' } } },
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
 * PENDING inclus (centre opérable par son propriétaire) — seul SUSPENDED est
 * exclu, aligné sur getCentresForUser.
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
    where: { userId, statut: { not: 'SUSPENDED' } },
    select: { id: true },
  });
  const collabs = await prisma.collaborateurCentre.findMany({
    where: { userId, acceptedAt: { not: null }, centre: { statut: { not: 'SUSPENDED' } } },
    select: { centreId: true },
  });
  const ids = new Set([
    ...owned.map((c) => c.id),
    ...collabs.map((c) => c.centreId),
  ]);
  return [...ids];
}
