import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TypeAbonnement = 'MENSUEL' | 'ANNUEL';
export type StatutAbonnementEnum = 'INACTIF' | 'ACTIF' | 'SUSPENDU';

export interface AbonnementStatut {
  type: TypeAbonnement | null;
  statut: StatutAbonnementEnum;
  actifJusquAu: string | null;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function simulerAbonnement(type: TypeAbonnement) {
  const { data } = await api.post('/abonnements/simuler', { type });
  return data;
}

export async function getAbonnementStatut(): Promise<AbonnementStatut> {
  const { data } = await api.get<AbonnementStatut>('/abonnements/statut');
  return data;
}
