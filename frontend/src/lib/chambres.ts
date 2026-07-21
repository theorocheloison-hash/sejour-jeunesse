import api from '@/src/lib/api';

// Module chambres — étage 1 : alertes de capacité globale (D9/D10).
// Contrat : backend/src/chambres/capacite.controller.ts. X-Centre-Id est posé
// par l'intercepteur de `api` (centre actif) — jamais de fetch direct.

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AlerteCapacite {
  sejourId: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  effectif: number;
  maxOccupationSignee: number;
  deficit: number;
  etat: 'ACTIVE' | 'ACQUITTEE';
  capaciteAlerteAcquitteeAt: string | null;
}

// Extension 21/07 : fenêtre où les seuls séjours SIGNÉS dépassent la capacité.
// Non acquittable — elle ne se tait que quand la surcapacité disparaît.
export interface SurEngagement {
  dateDebut: string;
  dateFin: string; // EXCLUSIVE — [debut, fin), afficher la veille
  pic: number;
  deficit: number;
  sejours: Array<{ id: string; titre: string }>;
}

export interface AlertesCapaciteResponse {
  capacite: number;
  alertes: AlerteCapacite[];
  // Optionnel : rétrocompatible avec un backend qui ne le renvoie pas encore.
  surEngagements?: SurEngagement[];
}

// ─── Fonctions API ───────────────────────────────────────────────────────────

export async function getAlertesCapacite(): Promise<AlertesCapaciteResponse> {
  const r = await api.get('/chambres/alertes-capacite');
  return r.data;
}

export async function acquitterAlerteCapacite(
  sejourId: string,
): Promise<{ sejourId: string; capaciteAlerteAcquitteeAt: string; etat: 'ACQUITTEE' }> {
  const r = await api.patch(`/chambres/alertes-capacite/${sejourId}/acquitter`);
  return r.data;
}
