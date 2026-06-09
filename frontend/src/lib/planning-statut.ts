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

// Lot 1 : la facturation vit dans l'entité Facture (le devis ne mute plus vers FACTURE_*).
interface DevisPourCouleur {
  statut: string;
  isComplementaire?: boolean;
  factures?: Array<{ typeFacture: string }> | null;
}

// Type structurel minimal — accepté par le SejourPlanning mono ET le type local global
interface SejourPourCouleur {
  statut: string;
  devisDirect?: Array<DevisPourCouleur>;
  demandes?: Array<{ devis?: Array<DevisPourCouleur> }>;
}

// Détecte le type de facture le plus avancé parmi les factures d'un devis,
// avec repli legacy sur l'ancien statut FACTURE_* (données antérieures au Lot 1).
function etatFacturationDevis(d: DevisPourCouleur): 'SOLDE' | 'ACOMPTE' | null {
  const types = (d.factures ?? []).map(f => f.typeFacture);
  if (types.includes('SOLDE') || d.statut === 'FACTURE_SOLDE') return 'SOLDE';
  if (types.includes('ACOMPTE') || d.statut === 'FACTURE_ACOMPTE') return 'ACOMPTE';
  return null;
}

export function derivePlanningStatut(sejour: SejourPourCouleur): string {
  const tousDevis: DevisPourCouleur[] = [
    ...(sejour.devisDirect ?? []),
    ...(sejour.demandes ?? []).flatMap(dem => dem.devis ?? []),
  ];

  // Seuls les devis principaux déterminent le statut planning (les complémentaires
  // sont des payeurs additionnels et ne pilotent pas la couleur du séjour).
  const devisListe = tousDevis.filter(d => !d.isComplementaire);

  // 1. Facturation (Facture liée) — rang max
  const etats = devisListe.map(etatFacturationDevis);
  if (etats.includes('SOLDE')) return 'SOLDE';
  if (etats.includes('ACOMPTE')) return 'ACOMPTE_VERSE';

  // 2. Sinon, statut devis le plus avancé (signé/sélectionné → Confirmé)
  const best = statutDevisLePlusAvance(devisListe.map(d => d.statut));
  if (best === 'FACTURE_SOLDE') return 'SOLDE';        // ceinture+bretelles legacy
  if (best === 'FACTURE_ACOMPTE') return 'ACOMPTE_VERSE';
  if (sejour.statut === 'OPTION') return 'OPTION';
  return 'CONFIRME'; // CONVENTION/SIGNE_DIRECTION/SOUMIS_RECTORAT/DECLARE_TAM/SUBMITTED
}
