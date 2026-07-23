import api from './api';

// ── Types ────────────────────────────────────────────────────────────────────

export type TypeDocumentSejour = 'PROGRAMME' | 'TRANSPORT' | 'ASSURANCE' | 'FACTURE' | 'AUTRE';

export interface MessageCollab {
  id: string;
  sejourId: string;
  auteurId: string;
  contenu: string;
  createdAt: string;
  auteur: { id: string; prenom: string; nom: string; role: string };
}

export interface PlanningActivite {
  id: string;
  sejourId: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  titre: string;
  description?: string;
  responsable?: string;
  couleur?: string;
  estManuelle?: boolean;
  estCollective?: boolean;
  groupes: Array<{ id: string; nom: string; couleur: string }>;
  createdAt: string;
}

export interface DocumentSejour {
  id: string;
  sejourId: string;
  uploaderId: string;
  nom: string;
  type: TypeDocumentSejour;
  url: string;
  createdAt: string;
  uploader: { id: string; prenom: string; nom: string };
}

export interface SejourCollabInfo {
  id: string;
  titre: string;
  lieu: string;
  dateDebut: string | null;
  dateFin: string | null;
  placesTotales: number;
  nombreAccompagnateurs?: number | null;
  statut: string;
  inscriptionsCloturees: boolean;
  thematiquesPedagogiques: string[];
  createur?: { id: string; prenom: string; nom: string; email: string };
  hebergementSelectionne?: {
    id: string; nom: string; ville: string; userId: string;
    email?: string | null;
    champsInscription?: {
      champsActifs: string[];
      champsCustom: Array<{ nom: string; type: 'text' | 'number' | 'select'; obligatoire: boolean; options?: string[] }>;
    } | null;
  };
  modeGestion?: string;
  natureSejour?: string;
  typeSejour?: string | null;
  // Déjà renvoyé par GET /collaboration/:id (include sans select restrictif) — §2.4.
  typeContexte?: 'SCOLAIRE' | 'HORS_SCOLAIRE' | null;
  clientNom?: string | null;
  clientPrenom?: string | null;
  clientEmail?: string | null;
  clientTelephone?: string | null;
  clientOrganisation?: string | null;
  clientAdresse?: string | null;
  clientCodePostal?: string | null;
  clientVille?: string | null;
  notesInternes?: string | null;
  // Invitation collaborative en attente (séjour DIRECT) — null si aucune / déjà acceptée.
  invitationCollab?: { email: string; createdAt: string } | null;
}

export interface SejourConventionHebergeur {
  id: string;
  titre: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  createur?: { prenom: string; nom: string };
  hebergementSelectionne?: { nom: string };
  planningActivites: {
    id: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description: string | null;
    responsable: string | null;
    couleur: string | null;
  }[];
}

export interface SejourPlanning {
  id: string;
  titre: string;
  lieu: string;
  dateDebut: string | null;
  dateFin: string | null;
  placesTotales: number;
  nombreAccompagnateurs?: number | null;
  statut: string;
  modeGestion: string;
  natureSejour: string;
  typeSejour: string | null;
  clientNom: string | null;
  clientOrganisation: string | null;
  createur?: { prenom: string; nom: string } | null;
  hebergementSelectionne?: { nom: string } | null;
  planningActivites: {
    id: string;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description: string | null;
    responsable: string | null;
    couleur: string | null;
  }[];
  devisDirect?: Array<{ statut: string; isComplementaire?: boolean; factures?: Array<{ typeFacture: string }> }>;
  demandes?: Array<{ devis?: Array<{ statut: string; isComplementaire?: boolean; factures?: Array<{ typeFacture: string }> }> }>;
}

export interface Participant {
  id: string;
  eleveNom: string;
  elevePrenom: string;
  parentEmail: string;
  signeeAt: string | null;
  taille: number | null;
  poids: number | null;
  pointure: number | null;
  regimeAlimentaire: string | null;
  niveauSki: string | null;
  infosMedicales: string | null;
  documentMedicalUrl?: string | null;
  nomParent?: string | null;
  telephoneUrgence?: string | null;
  attestationAssuranceUrl?: string | null;
  eleveDateNaissance?: string | null;
  moyenPaiement?: string | null;
  nombreMensualites?: number | null;
  paiementValide?: boolean;
  datePaiement?: string | null;
  montantVerseTotal?: number | null;
  nombreVersementsEffectues?: number | null;
  champsPersonnalises?: Record<string, unknown> | null;
  sourceInscription?: string | null;
  // SC7 : donnée d'organisation interne (organisateur), null = non catégorisé
  hebergementCategorie?: 'FILLE' | 'GARCON' | 'AUTRE' | null;
  createdAt: string;
}

// ── API calls ────────────────────────────────────────────────────────────────

export async function getSejourCollabInfo(sejourId: string): Promise<SejourCollabInfo> {
  const { data } = await api.get<SejourCollabInfo>(`/collaboration/${sejourId}`);
  return data;
}

export async function getMessages(sejourId: string): Promise<MessageCollab[]> {
  const { data } = await api.get<MessageCollab[]>(`/collaboration/${sejourId}/messages`);
  return data;
}

export async function sendMessage(sejourId: string, contenu: string): Promise<MessageCollab> {
  const { data } = await api.post<MessageCollab>(`/collaboration/${sejourId}/messages`, { contenu });
  return data;
}

export async function getPlanning(sejourId: string): Promise<PlanningActivite[]> {
  const { data } = await api.get<PlanningActivite[]>(`/collaboration/${sejourId}/planning`);
  return data;
}

export async function createPlanning(
  sejourId: string,
  body: { date: string; heureDebut: string; heureFin: string; titre: string; description?: string; responsable?: string; couleur?: string; estCollective?: boolean; estManuelle?: boolean; groupeIds?: string[] },
): Promise<PlanningActivite> {
  const { data } = await api.post<PlanningActivite>(`/collaboration/${sejourId}/planning`, body);
  return data;
}

export async function deletePlanning(sejourId: string, planningId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/planning/${planningId}`);
}

export async function getDocuments(sejourId: string): Promise<DocumentSejour[]> {
  const { data } = await api.get<DocumentSejour[]>(`/collaboration/${sejourId}/documents`);
  return data;
}

export async function createDocument(
  sejourId: string,
  body: { nom: string; type: TypeDocumentSejour },
  file?: File,
): Promise<DocumentSejour> {
  if (file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('nom', body.nom);
    formData.append('type', body.type);
    const { data } = await api.post<DocumentSejour>(`/collaboration/${sejourId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
  const { data } = await api.post<DocumentSejour>(`/collaboration/${sejourId}/documents`, body);
  return data;
}

export async function getParticipants(sejourId: string): Promise<Participant[]> {
  const { data } = await api.get<Participant[]>(`/collaboration/${sejourId}/participants`);
  return data;
}

export async function getMesSejoursConvention(): Promise<SejourConventionHebergeur[]> {
  const { data } = await api.get<SejourConventionHebergeur[]>('/collaboration/mes-sejours');
  return data;
}

export async function getMesSejoursPlanning(): Promise<SejourPlanning[]> {
  const { data } = await api.get<SejourPlanning[]>('/collaboration/mes-sejours-planning');
  return data;
}

export async function createSejourDirect(dto: {
  titre: string;
  natureSejour: string;
  typeSejour?: string;
  dateDebut?: string;
  dateFin?: string;
  nombreParticipants: number;
  nombreAccompagnateurs?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientEmail?: string;
  clientTelephone?: string;
  clientOrganisation?: string;
  clientOrganisationId?: string;
  clientAdresse?: string;
  clientCodePostal?: string;
  clientVille?: string;
  description?: string;
  clientId?: string;
  moisSouhaite?: number;
  anneeSouhaitee?: number;
  noteDateFlexible?: string;
  dureeNuits?: number;
}): Promise<SejourPlanning> {
  const { data } = await api.post<SejourPlanning>('/sejours/direct', dto);
  return data;
}

export async function deleteSejourDirect(sejourId: string): Promise<void> {
  await api.delete(`/sejours/${sejourId}`);
}

export async function inviterOrganisateurDirect(sejourId: string, emailOrganisateur: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/sejours/${sejourId}/inviter-organisateur`, { emailOrganisateur });
  return data;
}

// ── Documents centre (conformité) ────────────────────────────────────────────

export interface DocumentCentreFiche {
  id: string;
  type: string;
  nom: string;
  url: string | null;
  dateExpiration: string | null;
  createdAt: string;
}

export async function getDocumentsCentre(sejourId: string): Promise<DocumentCentreFiche[]> {
  const { data } = await api.get<DocumentCentreFiche[]>(`/collaboration/${sejourId}/documents-centre`);
  return data;
}

// ── Budget prévisionnel ──────────────────────────────────────────────────────

export interface LigneDevisBudget {
  id: string;
  description: string;
  quantite: number;
  prixUnitaire: number;
  tva: number;
  totalHT: number;
  totalTTC: number;
}

export interface DevisBudget {
  id: string;
  statut: string;
  montantTotal: number | null;
  montantTTC: number | null;
  montantHT: number | null;
  montantTVA: number | null;
  tauxTva: number | null;
  nomEntreprise: string | null;
  adresseEntreprise: string | null;
  siretEntreprise: string | null;
  emailEntreprise: string | null;
  telEntreprise: string | null;
  numeroDevis: string | null;
  pourcentageAcompte: number | null;
  montantAcompte: number | null;
  montantSolde: number | null;
  conditionsAnnulation: string | null;
  description: string | null;
  signatureDirecteur: string | null;
  nomSignataireDirecteur?: string | null;
  dateSignatureDirecteur?: string | null;
  signatureDocumentUrl?: string | null;
  createdAt: string;
  centre: {
    nom: string;
    ville: string;
    adresse: string;
    codePostal: string | null;
    siret: string | null;
    telephone: string | null;
    email: string | null;
    tvaIntracommunautaire: string | null;
    iban: string | null;
    logoUrl?: string | null;
  } | null;
  documentUrl?: string | null;
  conventionUrl?: string | null;
  lignes: LigneDevisBudget[];
}

export interface LigneCompl {
  id: string;
  categorie: string;
  description: string;
  montant: number;
  createdAt: string;
}

export interface RecetteBudget {
  id: string;
  source: string;
  montant: number;
  createdAt: string;
}

export interface BudgetData {
  sejour: {
    titre: string;
    lieu: string | null;
    niveauClasse: string | null;
    dateDebut: string | null;
    dateFin: string | null;
    placesTotales: number;
    nombreAccompagnateurs?: number | null;
    createur?: {
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      memberships?: Array<{
        organisation: {
          nom: string | null;
          ville: string | null;
          uai: string | null;
        };
      }>;
    };
  } | null;
  devis: DevisBudget | null;
  lignesCompl: LigneCompl[];
  recettes: RecetteBudget[];
}

export async function getBudgetData(sejourId: string): Promise<BudgetData> {
  const { data } = await api.get<BudgetData>(`/collaboration/${sejourId}/budget`);
  return data;
}

export async function addLigneCompl(sejourId: string, data: { categorie: string; description: string; montant: number }): Promise<LigneCompl> {
  const { data: res } = await api.post<LigneCompl>(`/collaboration/${sejourId}/budget/lignes-compl`, data);
  return res;
}

export async function deleteLigneCompl(sejourId: string, ligneId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/budget/lignes-compl/${ligneId}`);
}

export async function addRecetteBudget(sejourId: string, data: { source: string; montant: number }): Promise<RecetteBudget> {
  const { data: res } = await api.post<RecetteBudget>(`/collaboration/${sejourId}/budget/recettes`, data);
  return res;
}

export async function deleteRecetteBudget(sejourId: string, recetteId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/budget/recettes/${recetteId}`);
}

export interface ActiviteCatalogue {
  id: string;
  nom: string;
  description?: string;
  type: string;
  unite: string;
}

export async function getActivitesCatalogue(sejourId: string): Promise<ActiviteCatalogue[]> {
  const { data } = await api.get<ActiviteCatalogue[]>(
    `/collaboration/${sejourId}/activites-catalogue`
  );
  return data;
}

// ── Groupes séjour ──────────────────────────────────────────────────────────

export interface EleveGroupe {
  id: string;
  autorisationId: string;
  autorisation: { id: string; eleveNom: string; elevePrenom: string; signeeAt: string | null };
}

export interface GroupeSejour {
  id: string;
  sejourId: string;
  nom: string;
  couleur: string;
  taille: number;
  eleves: EleveGroupe[];
  createdAt: string;
}

export interface PropositionGroupes {
  groupes: { nom: string; couleur: string; taille: number }[];
  tailleGroupe: number;
  nombreGroupes: number;
  nombreEleves: number;
  nombreAccompagnateurs: number;
}

export async function getGroupes(sejourId: string): Promise<GroupeSejour[]> {
  const { data } = await api.get<GroupeSejour[]>(`/collaboration/${sejourId}/groupes`);
  return data;
}

export async function createGroupe(sejourId: string, dto: { nom: string; couleur: string; taille: number }): Promise<GroupeSejour> {
  const { data } = await api.post<GroupeSejour>(`/collaboration/${sejourId}/groupes`, dto);
  return data;
}

export async function updateGroupe(sejourId: string, groupeId: string, dto: { nom?: string; couleur?: string; taille?: number }): Promise<GroupeSejour> {
  const { data } = await api.patch<GroupeSejour>(`/collaboration/${sejourId}/groupes/${groupeId}`, dto);
  return data;
}

export async function deleteGroupe(sejourId: string, groupeId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/groupes/${groupeId}`);
}

export async function proposerGroupes(sejourId: string): Promise<PropositionGroupes> {
  const { data } = await api.post<PropositionGroupes>(`/collaboration/${sejourId}/groupes/proposer`);
  return data;
}

export async function affecterEleve(sejourId: string, groupeId: string, autorisationId: string): Promise<void> {
  await api.post(`/collaboration/${sejourId}/groupes/${groupeId}/eleves/${autorisationId}`);
}

export async function retirerEleve(sejourId: string, autorisationId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/groupes/eleves/${autorisationId}`);
}

export async function cloturerInscriptions(sejourId: string): Promise<void> {
  await api.post(`/collaboration/${sejourId}/cloturer-inscriptions`);
}

// ─── Rooming (SC7) — affectation participant→chambre, geste ORGANISATEUR ────
// Contrat : backend/src/chambres/affectation.controller.ts. Routes ORGANISATEUR
// (accès createurId/collaborateur côté back) : AUCUN header X-Centre-Id.

export interface RoomingOccupant {
  affectationId: string;
  type: 'ELEVE' | 'ENCADRANT';
  nom: string;
  prenom: string;
  signee: boolean;
}

export interface RoomingChambre {
  occupationId: string;
  chambreId: string;
  nom: string;
  etage: string | null;
  ordre: number;
  capacite: number;
  etiquette: string | null;
  couleur: string | null;
  occupants: RoomingOccupant[];
}

export interface RoomingParticipant {
  id: string;
  nom: string;
  prenom: string;
  hebergementCategorie?: 'FILLE' | 'GARCON' | 'AUTRE' | null;
  signee?: boolean;
}

export interface RoomingData {
  chambres: RoomingChambre[];
  nonAffectes: { eleves: RoomingParticipant[]; encadrants: RoomingParticipant[] };
}

export async function getRoomingCollab(sejourId: string): Promise<RoomingData> {
  const { data } = await api.get<RoomingData>('/chambres/rooming', { params: { sejourId } });
  return data;
}

export async function affecterChambre(
  sejourId: string,
  chambreId: string,
  body: { autorisationId?: string; accompagnateurId?: string },
): Promise<unknown> {
  const { data } = await api.post('/chambres/affectations', { sejourId, chambreId, ...body });
  return data;
}

export async function retirerChambre(affectationId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/chambres/affectations/${affectationId}`);
  return data;
}

export async function genererPlanningIA(sejourId: string, debutActivites?: string, finActivites?: string): Promise<{ jobId: string }> {
  const { data } = await api.post<{ jobId: string }>(`/collaboration/${sejourId}/planning/generer`, {
    debutActivites,
    finActivites,
  });
  return data;
}

export async function getPlanningGenerationStatus(sejourId: string, jobId: string): Promise<{
  status: 'pending' | 'done' | 'error';
  result?: any[];
  error?: string;
}> {
  const { data } = await api.get(`/collaboration/${sejourId}/planning/generer/${jobId}`);
  return data;
}

// ── Journal de séjour ───────────────────────────────────────────────────────

export interface PhotoJournal {
  id: string;
  url: string;
  ordre: number;
}

export interface PostJournal {
  id: string;
  sejourId: string;
  contenu: string;
  createdAt: string;
  auteur: { id: string; prenom: string; nom: string; role: string };
  photos: PhotoJournal[];
}

export async function getJournal(sejourId: string): Promise<PostJournal[]> {
  const { data } = await api.get<PostJournal[]>(`/collaboration/${sejourId}/journal`);
  return data;
}

export async function createJournalPost(
  sejourId: string,
  contenu: string,
  photos: File[],
): Promise<PostJournal> {
  const formData = new FormData();
  formData.append('contenu', contenu);
  photos.forEach((p) => formData.append('photos', p));
  const { data } = await api.post<PostJournal>(`/collaboration/${sejourId}/journal`, formData);
  return data;
}

export async function deleteJournalPost(sejourId: string, postId: string): Promise<void> {
  await api.delete(`/collaboration/${sejourId}/journal/${postId}`);
}

export async function notifierPlanningEnseignant(sejourId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/collaboration/${sejourId}/notifier-planning`);
  return data;
}

export async function updateInfosSejour(
  sejourId: string,
  dto: {
    titre?: string;
    dateDebut?: string;
    dateFin?: string;
    clientNom?: string;
    clientPrenom?: string;
    clientEmail?: string;
    clientTelephone?: string;
    clientAdresse?: string;
    clientCodePostal?: string;
    clientVille?: string;
    placesTotales?: number;
    nombreAccompagnateurs?: number;
  },
): Promise<{
  id: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  clientNom: string | null;
  clientPrenom: string | null;
  clientEmail: string | null;
  clientTelephone: string | null;
  clientAdresse: string | null;
  clientCodePostal: string | null;
  clientVille: string | null;
  placesTotales: number;
  nombreAccompagnateurs: number | null;
}> {
  const { data } = await api.patch(`/collaboration/${sejourId}/infos`, dto);
  return data;
}

// ── Notifications hébergeur ─────────────────────────────────

export interface NonLusSejour {
  sejourId: string;
  titre: string;
  messages: number;
  documents: number;
  journal: number;
}

export interface NonLusResponse {
  total: number;
  parSejour: NonLusSejour[];
}

export async function getMesNonLus(): Promise<NonLusResponse> {
  const res = await api.get('/collaboration/mes-non-lus');
  return res.data;
}

export async function marquerVisite(sejourId: string, onglet: string): Promise<void> {
  await api.post('/collaboration/marquer-visite', { sejourId, onglet });
}

// ── Notes & suivi (onglet TabNotes) ───────────────────────────────────────────

export type TypeActiviteClient =
  | 'APPEL' | 'EMAIL' | 'VISITE' | 'NOTE'
  | 'DEVIS' | 'SIGNATURE' | 'VERSEMENT' | 'BROCHURE';

export interface ActiviteSejour {
  id: string;
  clientId: string;
  centreId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  sejourId?: string | null;
  createdAt: string;
}

export interface RappelSejour {
  id: string;
  clientId: string;
  type: string;
  dateEcheance: string;
  description: string;
  statut: string;
  sejourId?: string | null;
  createdAt: string;
}

export async function updateNotesInternes(sejourId: string, notesInternes: string): Promise<void> {
  await api.patch(`/collaboration/sejour/${sejourId}/notes-internes`, { notesInternes });
}

export async function getActivitesSejour(sejourId: string): Promise<ActiviteSejour[]> {
  const { data } = await api.get<ActiviteSejour[]>(`/collaboration/sejour/${sejourId}/activites`);
  return data;
}

export async function createActiviteSejour(
  sejourId: string,
  dto: { type: string; description: string },
): Promise<ActiviteSejour> {
  const { data } = await api.post<ActiviteSejour>(`/collaboration/sejour/${sejourId}/activites`, dto);
  return data;
}

export async function getRappelsSejour(sejourId: string): Promise<RappelSejour[]> {
  const { data } = await api.get<RappelSejour[]>(`/collaboration/sejour/${sejourId}/rappels`);
  return data;
}

export async function createRappelSejour(
  sejourId: string,
  dto: { type: string; dateRappel: string; description: string },
): Promise<RappelSejour> {
  const { data } = await api.post<RappelSejour>(`/collaboration/sejour/${sejourId}/rappels`, dto);
  return data;
}

// ── Devis public (signature sans compte) ─────────────────────────────────

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

export interface DevisPublic {
  id: string;
  numeroDevis: string | null;
  statut: string;
  montantHT: number | null;
  montantTVA: number | null;
  montantTTC: number | null;
  tauxTva: number | null;
  pourcentageAcompte: number | null;
  montantAcompte: number | null;
  montantSolde: number | null;
  description: string | null;
  conditionsAnnulation: string | null;
  nomEntreprise: string | null;
  adresseEntreprise: string | null;
  siretEntreprise: string | null;
  emailEntreprise: string | null;
  telEntreprise: string | null;
  createdAt: string;
  documentUrl: string | null;
  isSigned: boolean;
  signatureDirecteur: string | null;
  nomSignataireDirecteur: string | null;
  dateSignatureDirecteur: string | null;
  signatureDocumentUrl: string | null;
  contratUrl: string | null;
  lignes: { description: string; quantite: number; prixUnitaire: number; tva: number; totalHT: number; totalTTC: number }[];
  centre: {
    nom: string; ville: string; adresse: string; codePostal: string | null;
    siret: string | null; telephone: string | null; email: string | null;
    tvaIntracommunautaire: string | null; iban: string | null;
    brochureUrl: string | null; conditionsAnnulation: string | null;
    logoUrl?: string | null;
  } | null;
  sejour: {
    id: string; titre: string; lieu: string;
    dateDebut: string | null; dateFin: string | null; placesTotales: number;
    nombreAccompagnateurs?: number | null;
    clientNom: string | null; clientPrenom: string | null; clientEmail: string | null;
    clientOrganisation: string | null; natureSejour: string; typeSejour: string | null;
    clientAdresse: string | null; clientCodePostal: string | null; clientVille: string | null;
  } | null;
}

export async function getDevisPublic(token: string): Promise<DevisPublic> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}`);
  if (!res.ok) throw new Error('Lien invalide');
  return res.json();
}

export async function signerDevisPublic(
  token: string,
  body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
): Promise<{ success: boolean }> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/signer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de la signature');
  }
  return res.json();
}

export async function envoyerDevisDirection(
  token: string,
  body: { emailDirecteur: string; nomDirecteur?: string },
): Promise<{ success: boolean }> {
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/envoyer-direction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de l\'envoi');
  }
  return res.json();
}

export async function uploadSignaturePublic(
  token: string,
  file: File,
): Promise<{ success: boolean }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${PUBLIC_API}/devis/public/${token}/upload-signature`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erreur lors de l\'upload');
  }
  return res.json();
}
