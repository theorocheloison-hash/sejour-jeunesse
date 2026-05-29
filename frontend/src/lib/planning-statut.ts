// Palette planning par statut (convention PMS — docs/ARCHITECTURE_UX_SEJOUR_FINAL.md §4)
// EXACTEMENT 5 états : la légende du planning mono itère cet objet.
export const PLANNING_COULEURS: Record<string, { bg: string; text: string; hachures?: boolean; label: string }> = {
  OPTION:        { bg: '#F59E0B', text: '#fff', hachures: true, label: 'Option' },
  CONFIRME:      { bg: '#2563EB', text: '#fff', label: 'Confirmé' },
  ACOMPTE_VERSE: { bg: '#16A34A', text: '#fff', label: 'Acompte versé' },
  SOLDE:         { bg: '#6B7280', text: '#fff', label: 'Soldé' },
  INDISPONIBLE:  { bg: '#DC2626', text: '#fff', hachures: true, label: 'Indisponible' },
};

// État séparé (hors PLANNING_COULEURS) : demande/devis en attente, non encore confirmé.
// Utilisé par le planning global ; réservé au futur portage sur le planning mono.
export const COULEUR_DEMANDE_ATTENTE = {
  bg: '#FBBF24', text: '#fff', hachures: true, label: 'Demande en attente',
};

// Rang de "facturation" : plus le devis est avancé, plus le rang est élevé.
const RANG_FACTURATION: Record<string, number> = {
  FACTURE_SOLDE: 4, FACTURE_ACOMPTE: 3,
  SIGNE_DIRECTION: 2, SELECTIONNE: 2,
  EN_ATTENTE_VALIDATION: 1, EN_ATTENTE: 1, NON_RETENU: 0,
};

export function statutDevisLePlusAvance(statuts: string[]): string | null {
  if (!statuts.length) return null;
  return statuts.reduce((best, s) =>
    (RANG_FACTURATION[s] ?? -1) > (RANG_FACTURATION[best] ?? -1) ? s : best
  );
}

// Type structurel minimal — accepté par le SejourPlanning mono ET le type local global
interface SejourPourCouleur {
  statut: string;
  devisDirect?: Array<{ statut: string }>;
  demandes?: Array<{ devis?: Array<{ statut: string }> }>;
}

export function derivePlanningStatut(sejour: SejourPourCouleur): string {
  const statuts = [
    ...(sejour.devisDirect ?? []).map(d => d.statut),
    ...(sejour.demandes ?? []).flatMap(dem => (dem.devis ?? []).map(d => d.statut)),
  ];
  const best = statutDevisLePlusAvance(statuts);
  if (best === 'FACTURE_SOLDE') return 'SOLDE';
  if (best === 'FACTURE_ACOMPTE') return 'ACOMPTE_VERSE';
  if (sejour.statut === 'OPTION') return 'OPTION';
  return 'CONFIRME'; // CONVENTION/SIGNE_DIRECTION/SOUMIS_RECTORAT/DECLARE_TAM/APPROVED/SUBMITTED
}
