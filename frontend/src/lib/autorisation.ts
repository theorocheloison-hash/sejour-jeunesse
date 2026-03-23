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
  taille: number | null;
  poids: number | null;
  pointure: number | null;
  regimeAlimentaire: string | null;
  niveauSki: string | null;
  infosMedicales: string | null;
  moyenPaiement?: string | null;
  paiementValide?: boolean;
  datePaiement?: string | null;
  createdAt: string;
}

export interface AutorisationPublique {
  eleveNom: string;
  elevePrenom: string;
  signeeAt: string | null;
  attestationAssuranceUrl?: string | null;
  moyenPaiement?: string | null;
  paiementValide?: boolean;
  datePaiement?: string | null;
  sejour: {
    titre: string;
    lieu: string;
    dateDebut: string;
    dateFin: string;
    description: string | null;
    niveauClasse: string | null;
    thematiquesPedagogiques: string[];
    placesTotales: number;
    montantParEleve: string | null;
  };
  hebergement: {
    nom: string;
    adresse: string | null;
    ville: string;
    type: string;
    capacite: number;
  } | null;
}

export interface CreateAutorisationDto {
  sejourId: string;
  eleveNom: string;
  elevePrenom: string;
  parentEmail: string;
}

export interface SignerAutorisationDto {
  taille?: number;
  poids?: number;
  pointure?: number;
  regimeAlimentaire?: string;
  niveauSki?: string;
  infosMedicales?: string;
  nomParent?: string;
  telephoneUrgence?: string;
  eleveDateNaissance?: string;
  rgpdAccepte: boolean;
  nombreMensualites?: number;
  moyenPaiement?: string;
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

export async function validerPaiement(autorisationId: string): Promise<void> {
  await api.patch(`/autorisations/${autorisationId}/valider-paiement`);
}

export async function validerPaiementPartiel(autorisationId: string, montant: number): Promise<void> {
  await api.patch(`/autorisations/${autorisationId}/valider-paiement-partiel`, { montant });
}

export async function uploadDocumentMedical(
  token: string,
  file: File,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  await api.post(`/autorisations/${token}/document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
