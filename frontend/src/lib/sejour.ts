import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutSejour = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CONVENTION';
export type AppelOffreStatut = 'BROUILLON' | 'OUVERT' | 'FERME';
export type TypeZone = 'FRANCE' | 'REGION' | 'DEPARTEMENT' | 'VILLE';

export interface CreateSejourDto {
  titre: string;
  informationsComplementaires?: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  niveauClasse: string;
  thematiquesPedagogiques: string[];
  typeZone: TypeZone;
  zoneGeographique: string;
  dateButoireDevis?: string;
}

export interface DevisSelectionne {
  id: string;
  statut: string;
  montantTotal: string;
  montantTTC: number | null;
  typeDocument: string;
  estFacture: boolean;
  numeroFacture: string | null;
  montantAcompte: number | null;
  pourcentageAcompte: number | null;
  centre?: { nom: string };
}

export interface SejourDemande {
  id: string;
  _count: { devis: number };
  devis?: DevisSelectionne[];
}

export interface Sejour {
  id: string;
  titre: string;
  informationsComplementaires?: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  placesRestantes: number;
  prix: number;
  statut: StatutSejour;
  niveauClasse: string | null;
  thematiquesPedagogiques: string[];
  typeZone: TypeZone | null;
  zoneGeographique: string | null;
  dateButoireDevis: string | null;
  appelOffreStatut: AppelOffreStatut;
  demandes?: SejourDemande[];
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
