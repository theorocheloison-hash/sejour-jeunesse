import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutSejour = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface CreateSejourDto {
  titre: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  villeHebergement: string;
  capaciteSouhaitee?: number;
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
  statut: StatutSejour;
}

export interface SejourDirecteur extends Sejour {
  createur: { prenom: string; nom: string } | null;
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

export async function getAllSejours(): Promise<SejourDirecteur[]> {
  const { data } = await api.get<SejourDirecteur[]>('/sejours');
  return data;
}

export async function updateSejourStatus(id: string, statut: StatutSejour): Promise<Sejour> {
  const { data } = await api.patch<Sejour>(`/sejours/${id}/status`, { statut });
  return data;
}
