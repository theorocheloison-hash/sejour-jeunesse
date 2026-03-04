import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type TypeHebergement = 'chalet' | 'tente' | 'auberge' | 'hotel' | 'gite' | 'autre';

export interface Hebergement {
  id: string;
  nom: string;
  type: TypeHebergement;
  adresse: string | null;
  ville: string;
  capacite: number;
  prixParJour: number | null;
  agrement: boolean;
  telephone: string | null;
  email: string | null;
  activites: string[];
  description: string | null;
}

export interface SearchHebergementParams {
  ville?: string;
  capaciteMin?: number;
  capaciteMax?: number;
  prixMax?: number;
  agrement?: boolean;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function searchHebergements(params?: SearchHebergementParams): Promise<Hebergement[]> {
  const { data } = await api.get<Hebergement[]>('/hebergements', { params });
  return data;
}

export async function getHebergement(id: string): Promise<Hebergement> {
  const { data } = await api.get<Hebergement>(`/hebergements/${id}`);
  return data;
}
