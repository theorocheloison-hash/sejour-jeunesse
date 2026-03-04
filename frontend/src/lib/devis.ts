import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutDevis = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE' | 'EN_ATTENTE_VALIDATION' | 'SELECTIONNE' | 'NON_RETENU';

export interface Devis {
  id: string;
  demandeId: string;
  centreId: string;
  montantTotal: string;
  montantParEleve: string;
  description: string | null;
  conditionsAnnulation: string | null;
  statut: StatutDevis;
  documentUrl: string | null;
  createdAt: string;
  demande?: {
    id: string;
    titre: string;
    villeHebergement: string;
    nombreEleves: number;
    enseignant?: { prenom: string; nom: string; email?: string };
    sejour?: { id: string; titre: string } | null;
  };
  centre?: {
    id: string;
    nom: string;
    ville: string;
    telephone?: string | null;
    email?: string | null;
    capacite?: number;
    description?: string | null;
  };
}

export interface CreateDevisDto {
  demandeId: string;
  montantTotal: string;
  montantParEleve: string;
  description?: string;
  conditionsAnnulation?: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function createDevis(dto: CreateDevisDto): Promise<Devis> {
  const { data } = await api.post<Devis>('/devis', dto);
  return data;
}

export async function getMesDevis(): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>('/devis/mes-devis');
  return data;
}

export async function getDevisForDemande(demandeId: string): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>(`/devis/demande/${demandeId}`);
  return data;
}

export async function getDevisAValider(): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>('/devis/a-valider');
  return data;
}

export async function getComparatif(demandeId: string): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>(`/demandes/${demandeId}/devis/comparatif`);
  return data;
}

export async function updateDevisStatut(id: string, statut: StatutDevis): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}/statut`, { statut });
  return data;
}
