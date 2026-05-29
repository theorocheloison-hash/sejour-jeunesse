import type { SejourPlanning } from './collaboration';

// Palette planning par statut (convention PMS — docs/ARCHITECTURE_UX_SEJOUR_FINAL.md §4)
export const PLANNING_COULEURS: Record<string, { bg: string; text: string; hachures?: boolean; label: string }> = {
  OPTION:        { bg: '#F59E0B', text: '#fff', hachures: true, label: 'Option' },
  CONFIRME:      { bg: '#2563EB', text: '#fff', label: 'Confirmé' },
  ACOMPTE_VERSE: { bg: '#16A34A', text: '#fff', label: 'Acompte versé' },
  SOLDE:         { bg: '#6B7280', text: '#fff', label: 'Soldé' },
  INDISPONIBLE:  { bg: '#DC2626', text: '#fff', hachures: true, label: 'Indisponible' },
};

export function derivePlanningStatut(sejour: SejourPlanning): string {
  // Statut du devis le plus avancé (DIRECT via devisDirect, COLLAB via demandes[0].devis[0])
  const devisStatut = sejour.devisDirect?.[0]?.statut
    ?? sejour.demandes?.[0]?.devis?.[0]?.statut
    ?? null;

  if (sejour.statut === 'OPTION') return 'OPTION';
  // CONVENTION ou SIGNE_DIRECTION → vérifier le statut du devis
  if (devisStatut === 'FACTURE_SOLDE') return 'SOLDE';
  if (devisStatut === 'FACTURE_ACOMPTE') return 'ACOMPTE_VERSE';
  return 'CONFIRME'; // CONVENTION ou SIGNE_DIRECTION sans facturation
}
