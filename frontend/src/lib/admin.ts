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
  source: string | null;
  demandesRecues: number;
  demandesReseau: number;
  devisEnvoyes: number;
  devisSelectionnes: number;
  caViaReseau: number;
  derniereActivite: string;
  onboardingScore: number;
  onboardingDetails: {
    profilComplet: boolean;
    mandatSigne: boolean;
    agrementRenseigne: boolean;
    siretRenseigne: boolean;
  };
}

export interface ReseauStats {
  reseau: string;
  nomComplet?: string;
  periode?: string;
  kpis: {
    totalCentres: number;
    centresActifs: number;
    demandesRecues: number;
    devisEnvoyes: number;
    devisSelectionnes: number;
    caTotal: number;
    tauxReponse: number;
    demandesReseau: number;
    devisReseau: number;
    caReseau: number;
    tauxConversionReseau: number;
    enseignantsAcquis: number;
    enseignantsFidelises: number;
  };
  centres: ReseauCentre[];
}

export async function getReseauStats(reseau: string): Promise<ReseauStats> {
  const { data } = await api.get<ReseauStats>(`/admin/reseau/${encodeURIComponent(reseau)}/stats`);
  return data;
}

export async function getMyReseauStats(periode?: string): Promise<ReseauStats> {
  const params = periode ? { periode } : {};
  const { data } = await api.get<ReseauStats>('/reseau/stats', { params });
  return data;
}

export interface DemandeReseauReponse {
  centreNom: string;
  centreVille: string;
  statut: string;
  montantTTC: number | null;
  dateReponse: string;
}

export interface DemandeReseau {
  id: string;
  createdAt: string;
  statut: string;
  titre: string;
  dateDebut: string | null;
  dateFin: string | null;
  moisSouhaite: number | null;
  anneeSouhaitee: number | null;
  dureeNuits: number | null;
  placesTotales: number;
  nombreAccompagnateurs: number | null;
  niveauClasse: string | null;
  typeContexte: string;
  departementsCibles: string[];
  regionCible: string;
  description: string | null;
  typePension: string[];
  transportAller: string | null;
  transportSurPlace: boolean | null;
  heureArrivee: string | null;
  heureDepart: string | null;
  budgetMaxParEleve: number | null;
  activitesSouhaitees: string | null;
  informationsComplementaires: string | null;
  dateButoireReponse: string | null;
  ageMin: number | null;
  ageMax: number | null;
  projetEducatif: string | null;
  thematiquesPedagogiques: string[];
  enseignant: { id: string; prenom: string; nom: string; email: string; telephone: string | null };
  organisation: { nom: string; ville: string | null; uai: string | null; typeStructure: string | null } | null;
  nombreReponses: number;
  reponses: DemandeReseauReponse[];
}

export async function getReseauDemandes(periode?: string): Promise<DemandeReseau[]> {
  const params = periode ? { periode } : {};
  const { data } = await api.get<DemandeReseau[]>('/reseau/demandes', { params });
  return data;
}

export async function updateCentreReseau(centreId: string, reseau: string | null): Promise<void> {
  await api.patch(`/admin/centres/${centreId}/reseau`, { reseau });
}

export async function inviterCentreReseau(email: string, nomCentre: string): Promise<void> {
  await api.post('/reseau/inviter', { email, nomCentre });
}

export async function getReseauCentreDetail(centreId: string): Promise<any> {
  const { data } = await api.get(`/reseau/centres/${centreId}`);
  return data;
}

// ─── Multi-centre — Claims + centres PENDING ──────────────────────────────

export interface CentreClaim {
  id: string;
  claimStatut: 'EN_ATTENTE_VALIDATION' | 'EN_ATTENTE_DOCUMENT' | 'VALIDE' | 'REFUSE' | 'NON_APPLICABLE';
  claimDocumentUrl: string | null;
  claimSiretExtrait: string | null;
  claimSubmittedAt: string | null;
  user: { id: string; prenom: string; nom: string; email: string };
  organisation: { id: string; nom: string; siret: string | null; ville: string | null };
}

export interface CentrePendingItem {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  capacite: number;
  siret: string | null;
  description: string | null;
  createdAt: string;
  statut: string;
  user: { id: string; prenom: string; nom: string; email: string } | null;
}

export async function getCentreClaimsPending(): Promise<CentreClaim[]> {
  const { data } = await api.get<CentreClaim[]>('/centres/admin/claims');
  return data;
}

export async function validateCentreClaim(
  membershipId: string,
  action: 'VALIDE' | 'REFUSE',
  raison?: string,
): Promise<{ message: string }> {
  const { data } = await api.patch<{ message: string }>(
    `/centres/admin/claims/${membershipId}`,
    { action, raison },
  );
  return data;
}

export async function getCentresPending(): Promise<CentrePendingItem[]> {
  const { data } = await api.get<CentrePendingItem[]>('/centres/admin/pending');
  return data;
}

export async function validateCentrePending(
  centreId: string,
  action: 'ACTIVE' | 'SUSPENDED',
): Promise<{ message: string }> {
  const { data } = await api.patch<{ message: string }>(
    `/centres/admin/pending/${centreId}`,
    { action },
  );
  return data;
}

export interface CentreAbonnement {
  id: string;
  nom: string;
  planAbonnement: string;
  abonnement: string | null;
  abonnementStatut: string;
  abonnementActifJusquAu: string | null;
  trialStartedAt: string | null;
  mollieCustomerId: string | null;
  mollieSubscriptionId: string | null;
  mollieMandatId: string | null;
  modePaiement: string | null;
  userId: string | null;
  user: { email: string; prenom: string; nom: string } | null;
}

export async function getAdminAbonnements(): Promise<CentreAbonnement[]> {
  const { data } = await api.get<CentreAbonnement[]>('/admin/abonnements');
  return data;
}

export interface FactureLiavo {
  id: string;
  numero: string;
  dateEmission: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  description: string;
  planAbonnement: string;
  typeAbonnement: string;
  pdfUrl: string | null;
  centreId: string;
  centre: { nom: string };
}

export async function getAdminFacturesLiavo(): Promise<FactureLiavo[]> {
  const { data } = await api.get<FactureLiavo[]>('/admin/factures-liavo');
  return data;
}

export interface MetriquesAbonnements {
  totalCentres: number;
  trialActifs: number;
  trialExpires: number;
  aboPayes: number;
  mrr: number;
}

export async function getAdminMetriquesAbonnements(): Promise<MetriquesAbonnements> {
  const { data } = await api.get<MetriquesAbonnements>('/admin/metriques-abonnements');
  return data;
}

export interface FeedEvent {
  type: 'NOUVEAU_COMPTE' | 'NOUVEAU_CENTRE' | 'NOUVEAU_SEJOUR' | 'NOUVELLE_DEMANDE' | 'NOUVEAU_DEVIS';
  date: string;
  data: Record<string, any>;
}

export interface SanteClient {
  id: string;
  nom: string;
  plan: string;
  isTrial: boolean;
  abonnementStatut: string;
  joursRestants: number | null;
  expiration: string | null;
  derniereActivite: string | null;
  joursDepuisActivite: number | null;
  signal: 'vert' | 'jaune' | 'rouge' | 'gris';
  nbSejours: number;
  nbDevis: number;
}

export interface KpisActivite {
  sejoursCreesMois: number;
  devisCreesMois: number;
  centresActifs: number;
  centresAvecSejour: number;
  tauxActivation: number;
}

export interface AdminActivite {
  feed: FeedEvent[];
  santeClients: SanteClient[];
  kpis: KpisActivite;
}

export async function getAdminActivite(): Promise<AdminActivite> {
  const { data } = await api.get<AdminActivite>('/admin/activite');
  return data;
}

export async function genererDevisLiavo(body: {
  centreId: string;
  plan: string;
  frequence: string;
  destinataireNom: string;
  destinataireAdresse?: string;
  destinataireSiret?: string;
  destinataireEmail?: string;
}): Promise<{ numero: string; pdfUrl: string }> {
  const { data } = await api.post<{ numero: string; pdfUrl: string }>('/admin/devis-liavo', body);
  return data;
}

export async function facturerCentre(body: {
  centreId: string;
  plan: string;
  frequence: string;
  destinataireNom?: string;
  destinataireAdresse?: string;
  destinataireSiret?: string;
  destinataireEmail?: string;
}): Promise<any> {
  const { data } = await api.post('/admin/facturer-centre', body);
  return data;
}
