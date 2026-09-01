import { StatutDevis } from '@prisma/client';

// Sets de statuts devis partagés (§4.13). Une constante PAR INTENTION et PAR
// COMPOSITION — ne pas fondre deux compositions différentes en un Set fourre-tout.
// Recensement et exceptions : docs/refacto-constantes-4.13.md §2.

/**
 * Devis « retenus » : CA confirmé. Un devis facturé (acompte/solde) est toujours
 * du CA confirmé, au même titre que SELECTIONNE/SIGNE_DIRECTION.
 */
export const STATUTS_DEVIS_RETENUS: StatutDevis[] = [
  StatutDevis.SELECTIONNE,
  StatutDevis.SIGNE_DIRECTION,
  StatutDevis.FACTURE_ACOMPTE,
  StatutDevis.FACTURE_SOLDE,
];

/**
 * Devis « engageants » : sélectionné ou signé direction (pas encore la notion
 * de facturation — Lot 1 : un devis facturé RESTE dans ces statuts). Pilote le
 * statut du séjour, bloque sa suppression, ouvre la facturation d'acompte.
 */
export const STATUTS_DEVIS_ENGAGEANTS: StatutDevis[] = [
  StatutDevis.SELECTIONNE,
  StatutDevis.SIGNE_DIRECTION,
];

/**
 * Devis « en cours » sur une demande / un séjour direct : non refusé, non signé
 * direction. Sert aux gardes anti-doublon (« un devis actif existe déjà »).
 */
export const STATUTS_DEVIS_EN_COURS: StatutDevis[] = [
  StatutDevis.EN_ATTENTE,
  StatutDevis.EN_ATTENTE_VALIDATION,
  StatutDevis.SELECTIONNE,
];

/**
 * Devis « visibles » côté organisateur : tout devis principal non refusé / non retenu,
 * de l'attente de signature jusqu'au solde. Pilote les lecteurs du dashboard, du dossier
 * pédagogique et du budget — un devis en attente (ou en cours de validation direction)
 * doit rester visible pour être signé depuis l'espace. Inclut FACTURE_* (legacy) pour ne
 * pas régresser sur les anciens devis facturés que RETENUS couvrait.
 */
export const STATUTS_DEVIS_VISIBLES_ORGANISATEUR: StatutDevis[] = [
  StatutDevis.EN_ATTENTE,
  StatutDevis.EN_ATTENTE_VALIDATION,
  StatutDevis.SELECTIONNE,
  StatutDevis.SIGNE_DIRECTION,
  StatutDevis.FACTURE_ACOMPTE,
  StatutDevis.FACTURE_SOLDE,
];
