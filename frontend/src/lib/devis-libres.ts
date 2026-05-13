import api from './api';

export type StatutDevisLibre = 'BROUILLON' | 'ENVOYE' | 'ACCEPTE' | 'REFUSE' | 'PAYE';

export interface LigneDevisLibre {
  id?: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tva: number;
  totalHT: number;
  totalTTC: number;
}

export interface VersementDevisLibre {
  id: string;
  devisLibreId: string;
  montant: number;
  datePaiement: string;
  reference?: string | null;
  createdAt: string;
}

export interface DevisLibre {
  id: string;
  centreId: string;
  clientId?: string | null;
  nomClient: string;
  prenomClient?: string | null;
  emailClient?: string | null;
  telClient?: string | null;
  adresseClient?: string | null;
  typeEvenement?: string | null;
  dateDebut: string;
  dateFin: string;
  description?: string | null;
  conditionsAnnulation?: string | null;
  notesInternes?: string | null;
  statut: StatutDevisLibre;
  numeroDevis?: string | null;
  montantHT?: number | null;
  montantTVA?: number | null;
  montantTTC?: number | null;
  tauxTva?: number | null;
  pourcentageAcompte?: number | null;
  montantAcompte?: number | null;
  montantVerseTotal?: number;
  documentUrl?: string | null;
  contratUrl?: string | null;
  tokenSignature?: string;
  dateSignatureClient?: string | null;
  lignes?: LigneDevisLibre[];
  versements?: VersementDevisLibre[];
  client?: { id: string; nom: string; telephone?: string | null; email?: string | null } | null;
  centre?: { nom: string; adresse: string; ville: string; telephone?: string | null; email?: string | null } | null;
  createdAt: string;
}

export interface CreateDevisLibreDto {
  nomClient: string;
  prenomClient?: string;
  emailClient?: string;
  telClient?: string;
  adresseClient?: string;
  typeEvenement?: string;
  dateDebut: string;
  dateFin: string;
  description?: string;
  conditionsAnnulation?: string;
  notesInternes?: string;
  clientId?: string;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  tauxTva?: number;
  pourcentageAcompte?: number;
  montantAcompte?: number;
  lignes?: Omit<LigneDevisLibre, 'id'>[];
}

export const getMesDevisLibres = () =>
  api.get<DevisLibre[]>('/devis-libres').then(r => r.data);

export const getDevisLibre = (id: string) =>
  api.get<DevisLibre>(`/devis-libres/${id}`).then(r => r.data);

export const createDevisLibre = (dto: CreateDevisLibreDto) =>
  api.post<DevisLibre>('/devis-libres', dto).then(r => r.data);

export const updateDevisLibre = (id: string, dto: Partial<CreateDevisLibreDto>) =>
  api.patch<DevisLibre>(`/devis-libres/${id}`, dto).then(r => r.data);

export const deleteDevisLibre = (id: string) =>
  api.delete(`/devis-libres/${id}`);

export const envoyerDevisLibre = (id: string) =>
  api.post<DevisLibre>(`/devis-libres/${id}/envoyer`).then(r => r.data);

export const ajouterVersementDevisLibre = (
  id: string,
  montant: number,
  datePaiement: string,
  reference?: string,
) => api.post<DevisLibre>(`/devis-libres/${id}/versements`, { montant, datePaiement, reference }).then(r => r.data);

// Routes publiques — pas d'auth
export const getDevisLibrePublic = (token: string) =>
  api.get<DevisLibre>(`/devis-libres/signer/${token}`).then(r => r.data);

export const signerDevisLibre = (token: string, nomSignataire: string) =>
  api.post<{ success: boolean; message: string }>(`/devis-libres/signer/${token}`, {
    nomSignataire,
    confirmation: true,
  }).then(r => r.data);
