import api from './api';

// ─── Dépôt du justificatif de claim (Kbis, récépissé RNA, arrêté…) ───────────
// Deux endpoints backend selon le cas — ATTENTION, les noms de champ multipart
// diffèrent : (A) attend "file", (B) attend "document". Se tromper = fichier
// undefined côté backend.

/** Formats acceptés par le backend (uploadKbis ET uploadJustificatif). */
export const JUSTIFICATIF_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const JUSTIFICATIF_MAX_BYTES = 10 * 1024 * 1024;

export interface MonClaimStatut {
  claimStatut: 'EN_ATTENTE_DOCUMENT' | 'EN_ATTENTE_VALIDATION' | null;
  organisationNom?: string;
  organisationId?: string;
  membershipId?: string;
}

export interface CentrePending {
  id: string;
  nom: string;
  claimDocumentUrl: string | null;
  organisationId: string | null;
}

/**
 * Un centre PENDING est déjà couvert quand l'organisation à laquelle il
 * appartient a un claim EN_ATTENTE_VALIDATION : validerClaim active tous les
 * centres PENDING de l'organisation d'un coup — le justificatif de société
 * couvre ses centres. Lui redemander un document = boucle de redépôt.
 * Un hébergeur déjà validé (claimStatut null) n'est jamais concerné.
 */
export function centreCouvertParClaim(centre: CentrePending, claim: MonClaimStatut | null): boolean {
  return (
    claim?.claimStatut === 'EN_ATTENTE_VALIDATION' &&
    centre.organisationId != null &&
    centre.organisationId === claim.organisationId
  );
}

/** État du claim en cours du user (jamais 'VALIDE' : le backend ne liste que les 2 statuts en attente). */
export async function getMonClaimStatut(): Promise<MonClaimStatut> {
  const { data } = await api.get<MonClaimStatut>('/organisations/mon-claim-statut');
  return data;
}

/** Centres PENDING de l'hébergeur (tous, pas seulement le centre actif). */
export async function getMesCentresPending(): Promise<CentrePending[]> {
  const { data } = await api.get<CentrePending[]>('/centres/mes-centres-pending');
  return data;
}

/**
 * (A) Premier claim (inscription ex-nihilo) : passe le membership
 * EN_ATTENTE_DOCUMENT → EN_ATTENTE_VALIDATION + email admin.
 * Champ multipart "file". 400 si le claim n'est pas en EN_ATTENTE_DOCUMENT.
 */
export async function uploadKbisOrganisation(organisationId: string, file: File): Promise<{ claimStatut: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(`/organisations/${organisationId}/upload-kbis`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * (B) Centre PENDING (hébergeur déjà validé qui ajoute un centre, ou centre
 * sans organisation) : pose centre.claimDocumentUrl + email admin.
 * Champ multipart "document".
 */
export async function uploadJustificatifCentre(centreId: string, file: File): Promise<{ success: boolean; claimDocumentUrl: string }> {
  const formData = new FormData();
  formData.append('document', file);
  const { data } = await api.post(`/centres/${centreId}/upload-justificatif`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Validation client alignée sur le backend — retourne un message d'erreur FR ou null. */
export function validerFichierJustificatif(file: File): string | null {
  if (!JUSTIFICATIF_TYPES.includes(file.type)) {
    return 'Format non accepté. Utilisez un PDF, JPG ou PNG.';
  }
  if (file.size > JUSTIFICATIF_MAX_BYTES) {
    return 'Le fichier dépasse 10 Mo.';
  }
  return null;
}
