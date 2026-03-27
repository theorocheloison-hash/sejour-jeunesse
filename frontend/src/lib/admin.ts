import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalUtilisateurs: number;
  totalCentres: number;
  totalSejours: number;
  totalDevis: number;
  hebergeursEnAttente: number;
  utilisateursParRole: { role: string; count: number }[];
  sejoursParStatut: { statut: string; count: number }[];
}

export interface Hebergeur {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  telephone: string | null;
  compteValide: boolean;
  emailVerifie: boolean;
  createdAt: string;
  centres: {
    id: string;
    nom: string;
    ville: string;
    codePostal: string;
    capacite: number;
    siret: string | null;
    departement: string | null;
    agrementEducationNationale: string | null;
    statut: string;
    abonnementStatut: string;
  }[];
}

export interface Utilisateur {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: string;
  telephone: string | null;
  compteValide: boolean;
  emailVerifie: boolean;
  etablissementNom: string | null;
  createdAt: string;
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
  siret: string | null;
  departement: string | null;
  agrementEducationNationale: string | null;
  statut: string;
  abonnementStatut: string;
  createdAt: string;
  user: { id: string; prenom: string; nom: string; email: string; compteValide: boolean };
  _count: { devis: number };
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>('/admin/stats');
  return data;
}

export async function getHebergeurs(statut?: string): Promise<Hebergeur[]> {
  const params = statut ? { statut } : {};
  const { data } = await api.get<Hebergeur[]>('/admin/hebergeurs', { params });
  return data;
}

export async function validerHebergeur(id: string): Promise<void> {
  await api.patch(`/admin/hebergeurs/${id}/valider`);
}

export async function refuserHebergeur(id: string, motif?: string): Promise<void> {
  await api.patch(`/admin/hebergeurs/${id}/refuser`, { motif });
}

export async function getUtilisateurs(search?: string, role?: string): Promise<Utilisateur[]> {
  const params: any = {};
  if (search) params.search = search;
  if (role) params.role = role;
  const { data } = await api.get<Utilisateur[]>('/admin/utilisateurs', { params });
  return data;
}

export async function updateUtilisateur(id: string, updates: { role?: string; compteValide?: boolean }): Promise<Utilisateur> {
  const { data } = await api.patch<Utilisateur>(`/admin/utilisateurs/${id}`, updates);
  return data;
}

export async function getCentres(search?: string): Promise<Centre[]> {
  const params = search ? { search } : {};
  const { data } = await api.get<Centre[]>('/admin/centres', { params });
  return data;
}

// ─── Réseau partenaire ──────────────────────────────────────────────────────

export interface ReseauCentre {
  id: string;
  nom: string;
  ville: string;
  departement: string | null;
  capacite: number;
  statut: string;
  abonnementStatut: string;
  demandesRecues: number;
  devisEnvoyes: number;
  devisSelectionnes: number;
  caGenere: number;
  derniereActivite: string;
}

export interface ReseauStats {
  reseau: string;
  kpis: {
    totalCentres: number;
    centresActifs: number;
    demandesRecues: number;
    devisEnvoyes: number;
    devisSelectionnes: number;
    caTotal: number;
    tauxReponse: number;
  };
  centres: ReseauCentre[];
}

export async function getReseauStats(reseau: string): Promise<ReseauStats> {
  const { data } = await api.get<ReseauStats>(`/admin/reseau/${encodeURIComponent(reseau)}/stats`);
  return data;
}

export async function getMyReseauStats(): Promise<ReseauStats> {
  const { data } = await api.get<ReseauStats>('/reseau/stats');
  return data;
}

export async function updateCentreReseau(centreId: string, reseau: string | null): Promise<void> {
  await api.patch(`/admin/centres/${centreId}/reseau`, { reseau });
}
