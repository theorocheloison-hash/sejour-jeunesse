import type { PrismaService } from '../prisma/prisma.service.js';
import { getUserCentrePermissions, hasPermission } from '../centres/permission.helper.js';

// Un séjour DIRECT géré en propre par l'hébergeur du centre : le pivot
// n'est PAS createurId (null sur les DIRECT) mais le lien centre + le mode.
// Fail-closed si le centre n'a pas de propriétaire (userId null).
export function peutGererEnPropre(
  sejour: { modeGestion: string; hebergementSelectionne: { userId: string | null } | null },
  userId: string,
): boolean {
  return (
    sejour.modeGestion === 'DIRECT' &&
    sejour.hebergementSelectionne?.userId != null &&
    sejour.hebergementSelectionne.userId === userId
  );
}

// Version permission-aware pour les gestes d'écriture « en propre » (participants,
// etc.) : le propriétaire OU un collaborateur d'équipe `sejours: WRITE`, borné au
// même périmètre (DIRECT géré en propre). Aligné sur les droits du propriétaire.
export async function peutEcrireSejourEnPropre(
  prisma: PrismaService,
  sejour: {
    modeGestion: string;
    hebergementSelectionneId?: string | null;
    hebergementSelectionne: { userId: string | null } | null;
  },
  userId: string,
): Promise<boolean> {
  if (peutGererEnPropre(sejour, userId)) return true;
  if (sejour.modeGestion !== 'DIRECT' || !sejour.hebergementSelectionneId) return false;
  const perms = await getUserCentrePermissions(prisma, userId, sejour.hebergementSelectionneId);
  return !!perms && !perms.isOwner && hasPermission(perms, 'sejours', 'WRITE');
}

// Lecture d'un séjour par l'hébergeur du centre : propriétaire OU collaborateur
// d'équipe `sejours:READ`. Indépendant du mode (collaboratif inclus) et du statut.
// Pendant lecture de peutEcrireSejourEnPropre, sans la contrainte DIRECT.
export async function peutLireSejourHebergeur(
  prisma: PrismaService,
  sejour: {
    hebergementSelectionneId?: string | null;
    hebergementSelectionne: { userId: string | null } | null;
  },
  userId: string,
): Promise<boolean> {
  if (
    sejour.hebergementSelectionne?.userId != null &&
    sejour.hebergementSelectionne.userId === userId
  ) return true;
  if (!sejour.hebergementSelectionneId) return false;
  const perms = await getUserCentrePermissions(prisma, userId, sejour.hebergementSelectionneId);
  return !!perms && hasPermission(perms, 'sejours', 'READ');
}

// ── B4 module inscriptions v2 : « qui tient la main » sur les inscriptions ──
// Règle UNIQUE des gestes d'inscription (serveur + droits exposés au front via
// getSejourInfo.droitsInscriptions). Volontairement DISTINCTE de peutGererEnPropre /
// peutEcrireSejourEnPropre, qui bornent aussi les chambres et les groupes au DIRECT :
// les élargir ouvrirait ces modules à l'hébergeur sur un séjour collaboratif.
//
//   DIRECT                     → hébergeur (propriétaire ou collaborateur sejours:WRITE)
//   COLLAB, main ORGANISATEUR  → organisateur rattaché (createurId)
//   COLLAB, main HEBERGEUR     → hébergeur (idem DIRECT), l'organisateur passe en lecture
//
// Envoi du lien de signature aux familles : DIRECT → hébergeur ; COLLAB → organisateur,
// et SEULEMENT s'il tient la main. Un hébergeur ne contacte jamais les familles d'un
// séjour collaboratif (il y tient la main pour saisir/importer la liste du prof).
export const SELECT_SEJOUR_INSCRIPTIONS = {
  createurId: true,
  modeGestion: true,
  responsableInscriptions: true,
  hebergementSelectionneId: true,
  hebergementSelectionne: { select: { userId: true } },
} as const;

type SejourInscriptions = {
  createurId: string | null;
  modeGestion: string;
  responsableInscriptions: string;
  hebergementSelectionneId?: string | null;
  hebergementSelectionne: { userId: string | null } | null;
};

// Hébergeur du centre en écriture, indépendamment du mode : même périmètre que
// peutEcrireSejourEnPropre (propriétaire, ou collaborateur non-propriétaire sejours:WRITE).
async function estHebergeurEcriture(
  prisma: PrismaService,
  sejour: SejourInscriptions,
  userId: string,
): Promise<boolean> {
  if (
    sejour.hebergementSelectionne?.userId != null &&
    sejour.hebergementSelectionne.userId === userId
  ) return true;
  if (!sejour.hebergementSelectionneId) return false;
  const perms = await getUserCentrePermissions(prisma, userId, sejour.hebergementSelectionneId);
  return !!perms && !perms.isOwner && hasPermission(perms, 'sejours', 'WRITE');
}

// Liste des inscrits : ajout, saisie/modification, import, suppression, « autorisation reçue ».
export async function peutEcrireInscriptions(
  prisma: PrismaService,
  sejour: SejourInscriptions,
  userId: string,
): Promise<boolean> {
  if (sejour.modeGestion === 'DIRECT') return peutEcrireSejourEnPropre(prisma, sejour, userId);
  if (sejour.responsableInscriptions === 'HEBERGEUR') return estHebergeurEcriture(prisma, sejour, userId);
  return sejour.createurId !== null && sejour.createurId === userId;
}

// Envoi du lien de signature aux familles (POST /autorisations/envoyer-invitations).
export async function peutEnvoyerAuxFamilles(
  prisma: PrismaService,
  sejour: SejourInscriptions,
  userId: string,
): Promise<boolean> {
  if (sejour.modeGestion === 'DIRECT') return peutEcrireSejourEnPropre(prisma, sejour, userId);
  return (
    sejour.responsableInscriptions !== 'HEBERGEUR' &&
    sejour.createurId !== null &&
    sejour.createurId === userId
  );
}
