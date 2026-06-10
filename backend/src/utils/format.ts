/**
 * Formate un nombre de participants en distinguant élèves et accompagnateurs.
 *
 * `placesTotales` stocke l'effectif ÉLÈVES uniquement ; les accompagnateurs sont
 * comptés séparément (`nombreAccompagnateurs`). Le total réel = élèves + accompagnateurs.
 *
 * - accompagnateurs > 0 : « 45 participants (40 élèves + 5 accompagnateurs) »
 * - accompagnateurs 0/null : « 40 participants »
 */
export function formatParticipants(
  placesTotales: number,
  nombreAccompagnateurs?: number | null,
): string {
  const eleves = placesTotales ?? 0;
  const accompagnateurs = nombreAccompagnateurs ?? 0;
  if (accompagnateurs > 0) {
    const total = eleves + accompagnateurs;
    return `${total} participants (${eleves} élèves + ${accompagnateurs} accompagnateurs)`;
  }
  return `${eleves} participant${eleves > 1 ? 's' : ''}`;
}
