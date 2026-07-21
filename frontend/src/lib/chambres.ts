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

export interface AlertesCapaciteResponse {
  capacite: number;
  alertes: AlerteCapacite[];
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
