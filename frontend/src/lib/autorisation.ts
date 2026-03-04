import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AutorisationParentale {
  id: string;
  sejourId: string;
  eleveNom: string;
  elevePrenom: string;
  parentEmail: string;
  tokenAcces: string;
  signeeAt: string | null;
  infosMedicales: string | null;
  createdAt: string;
}

export interface AutorisationPublique {
  eleveNom: string;
  elevePrenom: string;
  signeeAt: string | null;
  sejour: {
    titre: string;
    lieu: string;
    dateDebut: string;
    dateFin: string;
  };
}

export interface CreateAutorisationDto {
  sejourId: string;
  eleveNom: string;
  elevePrenom: string;
  parentEmail: string;
}

export interface SignerAutorisationDto {
  infosMedicales?: string;
}

// ─── Appels protégés (enseignant) ──────────────────────────────────────────

export async function createAutorisation(
  dto: CreateAutorisationDto,
): Promise<AutorisationParentale> {
  const { data } = await api.post<AutorisationParentale>('/autorisations', dto);
  return data;
}

export async function getAutorisationsBySejour(
  sejourId: string,
): Promise<AutorisationParentale[]> {
  const { data } = await api.get<AutorisationParentale[]>(
    `/autorisations/sejour/${sejourId}`,
  );
  return data;
}

// ─── Appels publics (parent) ───────────────────────────────────────────────

export async function getAutorisationPublique(
  token: string,
): Promise<AutorisationPublique> {
  const { data } = await api.get<AutorisationPublique>(
    `/autorisations/signer/${token}`,
  );
  return data;
}

export async function signerAutorisation(
  token: string,
  dto: SignerAutorisationDto,
): Promise<void> {
  await api.patch(`/autorisations/signer/${token}`, dto);
}
