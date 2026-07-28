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
