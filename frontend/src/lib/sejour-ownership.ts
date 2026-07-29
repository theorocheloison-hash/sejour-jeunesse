import type { SejourCollabInfo } from './collaboration';
import type { User } from '../types/auth';

// Un séjour DIRECT géré en propre par l'hébergeur du centre : le pivot
// n'est PAS createur (null sur les DIRECT) mais le lien centre + le mode.
// Miroir du backend common/sejour-ownership.ts. Fail-closed : payload
// incomplet, centre sans propriétaire ou user absent → false.
export function peutGererEnPropre(
  sejour: SejourCollabInfo | null | undefined,
  user: User | null | undefined,
): boolean {
  return (
    sejour?.modeGestion === 'DIRECT' &&
    !!sejour.hebergementSelectionne?.userId &&
    sejour.hebergementSelectionne.userId === user?.id
  );
}
