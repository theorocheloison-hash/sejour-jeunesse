import type { DevisBudget, LigneCompl, RecetteBudget } from './collaboration';

// Totaux du budget prévisionnel (P6) — implémentation UNIQUE, extraite de
// TabBudget : consommée par l'affichage (TabBudget) et par l'état du bloc
// Budget (OrganisateurNav). Pas de fetch : calcul pur sur les données chargées.

export interface BudgetTotaux {
  totalHebergeur: number;
  totalCompl: number;
  totalDepenses: number;
  totalRecettes: number;
  solde: number;
}

export function calculerBudgetTotaux(
  devis: DevisBudget | null,
  lignesCompl: LigneCompl[],
  recettes: RecetteBudget[],
): BudgetTotaux {
  const lignesDevis = devis?.lignes ?? [];
  const totalHebergeur = lignesDevis.length > 0
    ? lignesDevis.reduce((sum, l) => sum + l.totalTTC, 0)
    : (devis?.montantTTC ?? 0);
  const totalCompl = lignesCompl.reduce((sum, l) => sum + l.montant, 0);
  const totalDepenses = totalHebergeur + totalCompl;
  const totalRecettes = recettes.reduce((sum, r) => sum + r.montant, 0);
  return { totalHebergeur, totalCompl, totalDepenses, totalRecettes, solde: totalRecettes - totalDepenses };
}
