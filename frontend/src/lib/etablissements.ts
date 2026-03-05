import api from './api';

export interface Etablissement {
  uai: string;
  nom: string;
  type: string;
  nature: string;
  adresse: string;
  codePostal: string;
  commune: string;
  mail: string | null;
  telephone: string | null;
  academie: string;
}

export async function rechercherEtablissements(q?: string, cp?: string): Promise<Etablissement[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cp) params.set('cp', cp);
  const { data } = await api.get<Etablissement[]>(`/etablissements/recherche?${params}`);
  return data;
}

export async function getEtablissement(uai: string): Promise<Etablissement | null> {
  const { data } = await api.get<Etablissement | null>(`/etablissements/${uai}`);
  return data;
}

export interface UserProfile {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: string;
  etablissementUai: string | null;
  etablissementNom: string | null;
  etablissementAdresse: string | null;
  etablissementVille: string | null;
  etablissementEmail: string | null;
  etablissementTelephone: string | null;
}

export async function getMyProfile(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/users/me');
  return data;
}

export async function updateMonEtablissement(etab: {
  etablissementUai: string;
  etablissementNom: string;
  etablissementAdresse?: string;
  etablissementVille?: string;
  etablissementEmail?: string;
  etablissementTelephone?: string;
}) {
  const { data } = await api.patch('/users/mon-etablissement', etab);
  return data;
}
