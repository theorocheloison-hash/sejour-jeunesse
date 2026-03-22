import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutDevis = 'EN_ATTENTE' | 'ACCEPTE' | 'REFUSE' | 'EN_ATTENTE_VALIDATION' | 'SELECTIONNE' | 'NON_RETENU';

export interface LigneDevis {
  id?: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tva: number;
  totalHT: number;
  totalTTC: number;
}

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
  // Professional fields
  nomEntreprise?: string | null;
  adresseEntreprise?: string | null;
  siretEntreprise?: string | null;
  emailEntreprise?: string | null;
  telEntreprise?: string | null;
  tauxTva?: number | null;
  montantHT?: number | null;
  montantTVA?: number | null;
  montantTTC?: number | null;
  pourcentageAcompte?: number | null;
  montantAcompte?: number | null;
  numeroDevis?: string | null;
  numeroFacture?: string | null;
  typeDevis?: string;
  typeDocument?: string;
  signatureDirecteur?: string | null;
  dateSignatureDirecteur?: string | null;
  nomSignataireDirecteur?: string | null;
  estFacture?: boolean;
  dateFacture?: string | null;
  acompteVerse?: boolean;
  dateVersementAcompte?: string | null;
  lignes?: LigneDevis[];
  demande?: {
    id: string;
    titre: string;
    villeHebergement: string;
    nombreEleves: number;
    enseignant?: { prenom: string; nom: string; email?: string; telephone?: string | null; etablissementNom?: string | null; etablissementAdresse?: string | null; etablissementVille?: string | null; etablissementUai?: string | null; etablissementEmail?: string | null; etablissementTelephone?: string | null };
    sejour?: { id: string; titre: string; dateDebut?: string; dateFin?: string; niveauClasse?: string | null; statut?: string | null; createur?: { prenom: string; nom: string; etablissementNom?: string | null; etablissementVille?: string | null } | null } | null;
  };
  centre?: {
    id: string;
    nom: string;
    ville: string;
    adresse?: string | null;
    codePostal?: string | null;
    siret?: string | null;
    telephone?: string | null;
    email?: string | null;
    capacite?: number;
    description?: string | null;
    tvaIntracommunautaire?: string | null;
    iban?: string | null;
    conditionsAnnulation?: string | null;
  };
}

export interface CreateDevisDto {
  demandeId: string;
  montantTotal: string;
  montantParEleve: string;
  description?: string;
  conditionsAnnulation?: string;
  // Professional fields
  nomEntreprise?: string;
  adresseEntreprise?: string;
  siretEntreprise?: string;
  emailEntreprise?: string;
  telEntreprise?: string;
  tauxTva?: number;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  pourcentageAcompte?: number;
  montantAcompte?: number;
  numeroDevis?: string;
  typeDevis?: string;
  lignes?: Omit<LigneDevis, 'id'>[];
}

export interface DemandeInfo {
  demande: {
    id: string;
    titre: string;
    description: string | null;
    dateDebut: string;
    dateFin: string;
    nombreEleves: number;
    nombreAccompagnateurs?: number | null;
    villeHebergement: string;
    enseignant?: {
      prenom: string; nom: string; email: string; telephone?: string | null;
      etablissementNom?: string | null; etablissementAdresse?: string | null;
      etablissementVille?: string | null; etablissementEmail?: string | null;
      etablissementTelephone?: string | null;
    };
    sejour?: {
      titre: string;
      lieu: string;
      dateDebut: string;
      dateFin: string;
      placesTotales: number;
      niveauClasse?: string | null;
    } | null;
  };
  centre: {
    id: string;
    nom: string;
    adresse: string;
    ville: string;
    codePostal: string;
    telephone?: string | null;
    email?: string | null;
  };
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

export async function signerDevis(id: string): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}/signer`);
  return data;
}

export async function getNextNumeroDevis(): Promise<{ numero: string }> {
  const { data } = await api.get<{ numero: string }>('/devis/next-numero');
  return data;
}

export async function getDemandeInfo(demandeId: string): Promise<DemandeInfo> {
  const { data } = await api.get<DemandeInfo>(`/devis/demande-info/${demandeId}`);
  return data;
}

export async function getFacturesAcompte(): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>('/devis/factures-acompte');
  return data;
}

export async function validerAcompte(id: string): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}/valider-acompte`);
  return data;
}

export async function getChorusXml(id: string): Promise<{ xml: string }> {
  const { data } = await api.get<{ xml: string }>(`/devis/${id}/chorus-xml`);
  return data;
}

export async function getDevisDetail(id: string): Promise<{ devis: Devis; centre: DemandeInfo['centre'] }> {
  const { data } = await api.get<{ devis: Devis; centre: DemandeInfo['centre'] }>(`/devis/${id}/detail`);
  return data;
}

export async function updateDevis(id: string, dto: Omit<CreateDevisDto, 'demandeId'>): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}`, dto);
  return data;
}

export async function facturerAcompte(id: string): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}/facturer-acompte`);
  return data;
}

export async function facturerSolde(id: string): Promise<Devis> {
  const { data } = await api.patch<Devis>(`/devis/${id}/facturer-solde`);
  return data;
}

export async function uploadDevisPdf(demandeId: string, file: File): Promise<Devis> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('demandeId', demandeId);
  formData.append('typeDevis', 'PDF');
  formData.append('montantTotal', '0');
  formData.append('montantParEleve', '0');
  const { data } = await api.post<Devis>('/devis', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
