import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AccompagnateurMission {
  id: string;
  sejourId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string | null;
  tokenAcces: string;
  signeeAt: string | null;
  signatureNom: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceTel: string | null;
  createdAt: string;
}

export interface AccompagnateurPublique {
  prenom: string;
  nom: string;
  email: string;
  signeeAt: string | null;
  sejour: {
    titre: string;
    lieu: string;
    dateDebut: string;
    dateFin: string;
    description: string | null;
    niveauClasse: string | null;
    etablissement: string | null;
    etablissementVille: string | null;
    enseignant: string | null;
  };
  hebergement: {
    nom: string;
    adresse: string | null;
    ville: string | null;
  } | null;
}

export interface CreateAccompagnateurDto {
  sejourId: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
}

export interface SignerAccompagnateurDto {
  signatureNom: string;
  rgpdAccepte: boolean;
  contactUrgenceNom?: string;
  contactUrgenceTel?: string;
}

// ─── Appels protégés (enseignant) ──────────────────────────────────────────

export async function createAccompagnateur(
  dto: CreateAccompagnateurDto,
): Promise<AccompagnateurMission> {
  const { data } = await api.post<AccompagnateurMission>('/accompagnateurs', dto);
  return data;
}

export async function getAccompagnateursBySejour(
  sejourId: string,
): Promise<AccompagnateurMission[]> {
  const { data } = await api.get<AccompagnateurMission[]>(
    `/accompagnateurs/sejour/${sejourId}`,
  );
  return data;
}

export async function getOrdreMissionHtml(
  id: string,
): Promise<{ html: string }> {
  const { data } = await api.get<{ html: string }>(
    `/accompagnateurs/${id}/ordre-mission-pdf`,
  );
  return data;
}

// ─── Appels publics (accompagnateur) ─────────────────────────────────────

export async function getAccompagnateurPublique(
  token: string,
): Promise<AccompagnateurPublique> {
  const { data } = await api.get<AccompagnateurPublique>(
    `/accompagnateurs/signer/${token}`,
  );
  return data;
}

export async function signerAccompagnateur(
  token: string,
  dto: SignerAccompagnateurDto,
): Promise<void> {
  await api.patch(`/accompagnateurs/signer/${token}`, dto);
}
