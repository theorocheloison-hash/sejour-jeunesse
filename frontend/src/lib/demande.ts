import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutDemande = 'OUVERTE' | 'FERMEE' | 'ANNULEE';

export interface Demande {
  id: string;
  titre: string;
  description: string | null;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  villeHebergement: string;
  regionCible: string;
  dateButoireReponse: string | null;
  statut: StatutDemande;
  sejourId: string;
  enseignantId: string;
  enseignant?: { id: string; prenom: string; nom: string; email: string };
  sejour?: { niveauClasse: string | null; thematiquesPedagogiques: string[] } | null;
  _count?: { devis: number };
  createdAt: string;
}

export interface CreateDemandeDto {
  titre: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  villeHebergement: string;
  regionCible?: string;
  dateButoireReponse?: string;
  sejourId: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function createDemande(dto: CreateDemandeDto): Promise<Demande> {
  const { data } = await api.post<Demande>('/demandes', dto);
  return data;
}

export async function getDemandesOuvertes(): Promise<Demande[]> {
  const { data } = await api.get<Demande[]>('/demandes');
  return data;
}

export async function getMesDemandes(): Promise<Demande[]> {
  const { data } = await api.get<Demande[]>('/demandes/mes-demandes');
  return data;
}

export async function getDemande(id: string): Promise<Demande> {
  const { data } = await api.get<Demande>(`/demandes/${id}`);
  return data;
}

export async function ignorerDemande(id: string): Promise<void> {
  await api.delete(`/demandes/${id}/ignorer`);
}
