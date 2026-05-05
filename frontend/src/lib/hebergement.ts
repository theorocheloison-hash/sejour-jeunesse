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
  source: string | null;
  reseau: string | null;
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
  niveauClasse?: string;
  heureArrivee?: string;
  heureDepart?: string;
  transportAller?: string;
  budgetMaxParEleve?: number;
}): Promise<{ sejourId: string }> {
  const { data } = await api.post<{ sejourId: string }>('/sejours/depuis-catalogue', dto);
  return data;
}

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

export async function searchHebergementsPublic(
  params?: SearchHebergementParams
): Promise<SearchHebergementResponse> {
  const qs = new URLSearchParams();
  if (params?.nom)        qs.set('nom',        params.nom);
  if (params?.ville)      qs.set('ville',      params.ville);
  if (params?.departement) qs.set('departement', params.departement);
  if (params?.region)     qs.set('region',     params.region);
  const url = `${PUBLIC_API}/hebergements${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return { total: 0, results: [] };
  return res.json();
}

export async function getHebergementPublic(id: string): Promise<Hebergement> {
  const PUBLIC_API2 = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';
  const res = await fetch(`${PUBLIC_API2}/hebergements/${id}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error('Hébergement introuvable');
  return res.json();
}
