import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateSejourDto {
  titre: string;
  description: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  hebergement?: {
    nom: string;
    capacite: number;
  };
}

export interface Sejour {
  id: string;
  titre: string;
  description?: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  placesRestantes: number;
  prix: number;
  statut: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function createSejour(dto: CreateSejourDto): Promise<Sejour> {
  const { data } = await api.post<Sejour>('/sejours', dto);
  return data;
}

export async function getMesSejours(): Promise<Sejour[]> {
  const { data } = await api.get<Sejour[]>('/sejours/me');
  return data;
}
