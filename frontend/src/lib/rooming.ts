// Brique rooming partagée (SC7) — palette de directives + regroupement spatial,
// consommée par la vue édition (TabRooming), la vue plan (RoomingPlanView) et
// à terme le PDF D13.

// Directives hébergeur (SC7 lot 1). `couleur` en base = le TOKEN court, jamais
// la classe — le backend reste agnostique et le token resservira au PDF.
export const ETIQUETTES = [
  { label: 'Filles', couleur: 'teal', cls: 'bg-teal-100 text-teal-700' },
  { label: 'Garçons', couleur: 'amber', cls: 'bg-amber-100 text-amber-700' },
  { label: 'Encadrants', couleur: 'violet', cls: 'bg-violet-100 text-violet-700' },
  { label: 'Mixte', couleur: 'slate', cls: 'bg-slate-100 text-slate-700' },
];

export interface EtageGroupe<T> { etage: string | null; chambres: T[]; }

// Regroupe par étage. Ordre des étages = min(ordre) de leurs chambres
// (respecte l'ordre physique encodé dans `ordre`, RDC avant Étage 1 si
// numéroté en montant). Dans un étage : ordre puis nom.
export function groupByEtage<T extends { etage: string | null; ordre: number; nom: string }>(
  chambres: T[],
): EtageGroupe<T>[] {
  const map = new Map<string, T[]>();
  const NULL_KEY = '\u0000null';
  for (const c of chambres) {
    const k = c.etage ?? NULL_KEY;
    const arr = map.get(k); if (arr) arr.push(c); else map.set(k, [c]);
  }
  const groupes = [...map.entries()].map(([k, list]) => ({
    etage: k === NULL_KEY ? null : k,
    chambres: list.sort((a, b) => (a.ordre !== b.ordre ? a.ordre - b.ordre : a.nom.localeCompare(b.nom))),
  }));
  return groupes.sort(
    (g1, g2) =>
      Math.min(...g1.chambres.map((c) => c.ordre)) - Math.min(...g2.chambres.map((c) => c.ordre)),
  );
}
