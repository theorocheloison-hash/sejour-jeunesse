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
