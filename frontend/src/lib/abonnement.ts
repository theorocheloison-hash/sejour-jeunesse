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

export async function souscrireAbonnement(plan: string, frequence: string, iban: string, titulaire: string, cgvAcceptee: boolean): Promise<{ success: boolean; plan: string; frequence: string; montant: number }> {
  const { data } = await api.post('/abonnements/souscrire', { plan, frequence, iban, titulaire, cgvAcceptee });
  return data;
}

export async function activerTrial(): Promise<void> {
  await api.post('/abonnements/trial');
}

export async function annulerAbonnement(): Promise<void> {
  await api.post('/abonnements/annuler');
}
