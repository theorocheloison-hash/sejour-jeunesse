import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  email: string;
  nomCentre: string;
  token: string;
  utilisedAt: string | null;
}

export interface Centre {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone: string | null;
  email: string | null;
  capacite: number;
  description: string | null;
  statut: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
}

export interface Disponibilite {
  id: string;
  dateDebut: string;
  dateFin: string;
  capaciteDisponible: number;
  commentaire: string | null;
}

export interface DocumentCentre {
  id: string;
  type: 'AGREMENT' | 'ASSURANCE' | 'AUTRE';
  nom: string;
  dateExpiration: string | null;
  createdAt: string;
}

export interface RegisterCentreDto {
  token: string;
  password: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone?: string;
  capacite: number;
  description?: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function getInvitation(token: string): Promise<Invitation> {
  const { data } = await api.get<Invitation>(`/invitations/accept/${token}`);
  return data;
}

export async function registerCentre(dto: RegisterCentreDto) {
  const { data } = await api.post<{ access_token: string; user: { id: string; email: string; prenom: string; nom: string; role: string }; centre: Centre }>('/centres/register', dto);
  return data;
}

export async function getMonProfil(): Promise<Centre> {
  const { data } = await api.get<Centre>('/centres/mon-profil');
  return data;
}

export async function updateMonProfil(dto: Partial<Centre>): Promise<Centre> {
  const { data } = await api.patch<Centre>('/centres/mon-profil', dto);
  return data;
}

export async function getDisponibilites(): Promise<Disponibilite[]> {
  const { data } = await api.get<Disponibilite[]>('/centres/disponibilites');
  return data;
}

export async function createDisponibilite(dto: {
  dateDebut: string;
  dateFin: string;
  capaciteDisponible: number;
  commentaire?: string;
}): Promise<Disponibilite> {
  const { data } = await api.post<Disponibilite>('/centres/disponibilites', dto);
  return data;
}

export async function deleteDisponibilite(id: string): Promise<void> {
  await api.delete(`/centres/disponibilites/${id}`);
}

export async function getDocuments(): Promise<DocumentCentre[]> {
  const { data } = await api.get<DocumentCentre[]>('/centres/documents');
  return data;
}

export async function createDocument(dto: {
  type: 'AGREMENT' | 'ASSURANCE' | 'AUTRE';
  nom: string;
  dateExpiration?: string;
}): Promise<DocumentCentre> {
  const { data } = await api.post<DocumentCentre>('/centres/documents', dto);
  return data;
}
