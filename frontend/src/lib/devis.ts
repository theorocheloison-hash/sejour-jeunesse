import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export type StatutDevis = 'EN_ATTENTE' | 'EN_ATTENTE_VALIDATION' | 'SELECTIONNE' | 'SIGNE_DIRECTION' | 'NON_RETENU' | 'FACTURE_ACOMPTE' | 'FACTURE_SOLDE';

export interface VersementPaiement {
  id: string;
  devisId: string;
  factureId?: string | null;
  montant: number;
  datePaiement: string;
  reference?: string | null;
  modePaiement?: string | null;
  createdAt: string;
}

// ── Facture (entité immuable — Lot 1) ────────────────────────────────────────
export interface LigneFacture {
  id: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tva: number;
  totalHT: number;
  totalTTC: number;
}

export interface Facture {
  id: string;
  devisId: string;
  sejourId: string | null;
  numero: string;
  typeFacture: 'ACOMPTE' | 'SOLDE';
  dateEmission: string;
  emetteurNom: string;
  emetteurAdresse: string | null;
  emetteurSiret: string | null;
  emetteurTva: string | null;
  emetteurEmail: string | null;
  emetteurTel: string | null;
  emetteurIban: string | null;
  destinataireNom: string;
  destinataireAdresse: string | null;
  destinataireSiret: string | null;
  destinataireEmail: string | null;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  tauxTva: number;
  montantFacture: number;
  pourcentageAcompte: number | null;
  factureAcompteId: string | null;
  montantAcompteDejaFacture: number | null;
  montantVerseTotal: number;
  acompteVerse: boolean;
  dateVersement: string | null;
  conditionsAnnulation: string | null;
  pdfUrl: string | null;
  createdAt: string;
  lignes?: LigneFacture[];
  versements?: VersementPaiement[];
}

/** Facture d'acompte liée à un devis (ou null). */
export function getFactureAcompte(devis: { factures?: Facture[] | null }): Facture | null {
  return devis.factures?.find(f => f.typeFacture === 'ACOMPTE') ?? null;
}
/** Facture de solde liée à un devis (ou null). */
export function getFactureSolde(devis: { factures?: Facture[] | null }): Facture | null {
  return devis.factures?.find(f => f.typeFacture === 'SOLDE') ?? null;
}
/** État de facturation dérivé des factures liées (plus le statut du devis). */
export function etatFacturation(devis: { factures?: Facture[] | null }): 'AUCUNE' | 'ACOMPTE' | 'SOLDE' {
  if (getFactureSolde(devis)) return 'SOLDE';
  if (getFactureAcompte(devis)) return 'ACOMPTE';
  return 'AUCUNE';
}

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
  demandeId: string | null;
  sejourDirectId?: string | null;
  tokenSignature?: string | null;
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
  montantSolde?: number | null;
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
  sejourDirect?: {
    id: string;
    titre: string;
    dateDebut: string;
    dateFin: string;
    clientNom: string | null;
    clientEmail: string | null;
    clientOrganisation: string | null;
    modeGestion: string;
  } | null;
  versements?: VersementPaiement[];
  factures?: Facture[];
  montantVerseTotal?: number;
  demande?: {
    id: string;
    titre: string;
    villeHebergement: string;
    nombreEleves: number;
    nombreAccompagnateurs?: number | null;
    enseignant?: {
      prenom: string;
      nom: string;
      email?: string;
      telephone?: string | null;
      memberships?: Array<{
        organisation: { nom: string | null; ville: string | null; uai: string | null };
      }>;
    };
    sejour?: {
      id: string;
      titre: string;
      dateDebut?: string;
      dateFin?: string;
      niveauClasse?: string | null;
      statut?: string | null;
      createur?: {
        prenom: string;
        nom: string;
        memberships?: Array<{
          organisation: { nom: string | null; ville: string | null };
        }>;
      } | null;
    } | null;
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
  demandeId?: string;
  sejourDirectId?: string;
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
  nombreEleves?: number;
  nombreAccompagnateurs?: number;
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
      memberships?: Array<{
        organisation: { nom: string | null; ville: string | null; uai: string | null };
      }>;
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
    siret?: string | null;
    telephone?: string | null;
    email?: string | null;
    conditionsAnnulation?: string | null;
  };
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function createDevis(dto: CreateDevisDto): Promise<Devis> {
  const { data } = await api.post<Devis>('/devis', dto);
  return data;
}

export async function createDevisWithFile(
  dto: { demandeId: string; montantTotal: string; montantParEleve: string; typeDevis: string },
  file: File,
): Promise<Devis> {
  const formData = new FormData();
  formData.append('file', file);
  Object.entries(dto).forEach(([k, v]) => formData.append(k, v));
  const { data } = await api.post<Devis>('/devis', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
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

/**
 * Factures d'acompte à valider (dashboard SIGNATAIRE).
 * Lot 1 : renvoie des Factures (type ACOMPTE non validées) avec leur devis imbriqué.
 */
export async function getFacturesAcompte(): Promise<Facture[]> {
  const { data } = await api.get<Facture[]>('/devis/factures-acompte');
  return data;
}

/** Valide le règlement d'une facture d'acompte (Lot 1 : id = factureId). */
export async function validerAcompte(factureId: string): Promise<Facture> {
  const { data } = await api.patch<Facture>(`/factures/${factureId}/valider-acompte`);
  return data;
}

/** Génère le XML Chorus Pro d'une facture (Lot 1 : id = factureId). */
export async function getChorusXml(factureId: string): Promise<{ xml: string }> {
  const { data } = await api.get<{ xml: string }>(`/factures/${factureId}/chorus-xml`);
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

// ── Facturation (Lot 1 : routes /factures, entité Facture immuable) ──────────

/** Émet la facture d'acompte d'un devis. Le devis n'est PAS muté. */
export async function emettreFactureAcompte(devisId: string): Promise<Facture> {
  const { data } = await api.post<Facture>('/factures/acompte', { devisId });
  return data;
}

/** Émet la facture de solde (total révisé du devis − acompte déjà facturé). */
export async function emettreFactureSolde(devisId: string): Promise<Facture> {
  const { data } = await api.post<Facture>('/factures/solde', { devisId });
  return data;
}

/** Factures liées à un devis. */
export async function getFacturesForDevis(devisId: string): Promise<Facture[]> {
  const { data } = await api.get<Facture[]>(`/factures/devis/${devisId}`);
  return data;
}

/** Enregistre un versement sur une facture (Lot 1 : ciblé par factureId). */
export async function ajouterVersement(factureId: string, montant: number, datePaiement: string, reference?: string, modePaiement?: string): Promise<Facture> {
  const { data } = await api.post<Facture>(`/factures/${factureId}/versements`, { montant, datePaiement, reference, modePaiement });
  return data;
}

/** Supprime un versement d'une facture. */
export async function supprimerVersement(factureId: string, versementId: string): Promise<Facture> {
  const { data } = await api.patch<Facture>(`/factures/${factureId}/versements/${versementId}/supprimer`);
  return data;
}

// ── PDF facture (Lot 2 : généré côté serveur, stocké sur OVH) ────────────────

/**
 * URL de téléchargement PDF d'une facture via le backend (redirect 302 → OVH).
 * Note : préférer `facture.pdfUrl` (URL OVH publique) pour un lien <a> direct,
 * car cette route est protégée et un <a target=_blank> n'envoie pas le token.
 */
export function getFacturePdfUrl(factureId: string): string {
  return `${process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr'}/factures/${factureId}/pdf`;
}

/** Régénère le PDF d'une facture (si génération initiale échouée). */
export async function regenererFacturePdf(factureId: string): Promise<{ pdfUrl: string | null }> {
  const { data } = await api.post<{ pdfUrl: string | null }>(`/factures/${factureId}/regenerer-pdf`);
  return data;
}

export async function notifierEnseignantDevis(devisId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/devis/${devisId}/notifier-enseignant`);
  return data;
}

// ── Séjour DIRECT ────────────────────────────────────────────────────────

export async function createDirectDevis(dto: CreateDevisDto & { sejourDirectId: string }): Promise<Devis> {
  const { data } = await api.post<Devis>('/devis/direct', dto);
  return data;
}

export async function envoyerDevisDirect(devisId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/devis/${devisId}/envoyer-direct`);
  return data;
}

export async function getDevisForSejourDirect(sejourDirectId: string): Promise<Devis[]> {
  const { data } = await api.get<Devis[]>('/devis/mes-devis');
  return data.filter(d => d.sejourDirectId === sejourDirectId);
}

