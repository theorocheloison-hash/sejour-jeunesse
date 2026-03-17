import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Hebergement {
  id: string;
  nom: string;
  ville: string;
  departement: string;
  region: string;
  codePostal: string;
  latitude: number | null;
  longitude: number | null;
  capaciteEleves: number | null;
  capaciteAdultes: number | null;
  description: string | null;
  image: string | null;
  permalien: string | null;
  contact: string | null;
  thematiques: string[];
  activites: string[];
  accessible: boolean;
  avisSecurite: string | null;
  periodeOuverture: string | null;
}

export interface SearchHebergementParams {
  nom?: string;
  ville?: string;
  departement?: string;
  region?: string;
}

export interface SearchHebergementResponse {
  total: number;
  results: Hebergement[];
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function searchHebergements(params?: SearchHebergementParams): Promise<SearchHebergementResponse> {
  const { data } = await api.get<SearchHebergementResponse>('/hebergements', { params });
  return data;
}

export async function getHebergement(id: string): Promise<Hebergement> {
  const { data } = await api.get<Hebergement>(`/hebergements/${id}`);
  return data;
}

export async function creerSejourDepuisCatalogue(dto: {
  centreId: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  message?: string;
}): Promise<{ sejourId: string }> {
  const { data } = await api.post<{ sejourId: string }>('/sejours/depuis-catalogue', dto);
  return data;
}
