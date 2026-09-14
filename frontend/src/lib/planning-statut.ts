import { etatEncaissement } from './encaissement';

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

// Lot 1 : la facturation vit dans l'entité Facture (le devis ne mute plus vers FACTURE_*).
interface DevisPourCouleur {
  statut: string;
  isComplementaire?: boolean;
  // Lot ENCAISSEMENT (socle) : montants remontés par les projections planning,
  // pas encore consommés par la logique couleur. montantTotal (Decimal) arrive sérialisé en string.
  montantTTC?: number | null;
  montantVerseTotal?: number | null;
  montantTotal?: string | null;
  // montantFacture : NÉGATIF pour les AVOIR (total net d'avoir côté Lot 2).
  factures?: Array<{ typeFacture: string; montantFacture?: number }> | null;
}

// Type structurel minimal — accepté par le SejourPlanning mono ET le type local global
interface SejourPourCouleur {
  statut: string;
  devisDirect?: Array<DevisPourCouleur>;
  demandes?: Array<{ devis?: Array<DevisPourCouleur> }>;
}

export function derivePlanningStatut(sejour: SejourPourCouleur): string {
  const tousDevis: DevisPourCouleur[] = [
    ...(sejour.devisDirect ?? []),
    ...(sejour.demandes ?? []).flatMap(dem => dem.devis ?? []),
  ];

  // Seuls les devis principaux déterminent le statut planning (les complémentaires
  // sont des payeurs additionnels et ne pilotent pas la couleur du séjour).
  const devisListe = tousDevis.filter(d => !d.isComplementaire);

  // 1. Encaissement (rang max : soldé > acompte versé)
  const etats = devisListe.map(etatEncaissement);
  if (etats.includes('SOLDE')) return 'SOLDE';
  if (etats.includes('ACOMPTE_VERSE')) return 'ACOMPTE_VERSE';

  // 2. Sinon, statut de signature (signé/sélectionné → Confirmé)
  if (sejour.statut === 'OPTION') return 'OPTION';
  return 'CONFIRME'; // CONVENTION/SIGNE_DIRECTION/SOUMIS_RECTORAT/DECLARE_TAM/SUBMITTED
}
