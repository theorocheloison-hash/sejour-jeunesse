import api from '@/src/lib/api';

export type TypeAbonnement = 'MENSUEL' | 'ANNUEL';

export type StatutAbonnementEnum = 'INACTIF' | 'ACTIF' | 'SUSPENDU';

export type PlanAbonnement = 'DECOUVERTE' | 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE';

export interface AbonnementStatut {
  type: TypeAbonnement | null;
  statut: StatutAbonnementEnum;
  actifJusquAu: string | null;
  plan: PlanAbonnement;
  actif: boolean;
  joursRestants: number;
  mandatActif: boolean;
  mollieSubscriptionId: string | null;
  isTrial: boolean;
  trialExpire: boolean;
  trialUsed: boolean;
}

export async function getAbonnementStatut(): Promise<AbonnementStatut> {
  const { data } = await api.get<AbonnementStatut>('/abonnements/statut');
  return data;
}

export async function checkoutAbonnement(plan: string, frequence: string): Promise<{ checkoutUrl: string; montant: number; plan: string; frequence: string }> {
  const { data } = await api.post('/abonnements/checkout', { plan, frequence });
  return data;
}

export async function activerTrial(): Promise<void> {
  await api.post('/abonnements/trial');
}

export async function annulerAbonnement(): Promise<void> {
  await api.post('/abonnements/annuler');
}
