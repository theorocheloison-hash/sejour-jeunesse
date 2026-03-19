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
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  statut: string;
  createur?: { id: string; prenom: string; nom: string; email: string };
  hebergementSelectionne?: { id: string; nom: string; ville: string; userId: string };
}

export interface SejourConventionVenue {
  id: string;
  titre: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  createur?: { prenom: string; nom: string };
  hebergementSelectionne?: { nom: string };
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
  body: { date: string; heureDebut: string; heureFin: string; titre: string; description?: string; responsable?: string },
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

export async function getMesSejoursConvention(): Promise<SejourConventionVenue[]> {
  const { data } = await api.get<SejourConventionVenue[]>('/collaboration/mes-sejours');
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
  conditionsAnnulation: string | null;
  description: string | null;
  createdAt: string;
  centre: {
    nom: string;
    ville: string;
    adresse: string;
    codePostal: string | null;
    siret: string | null;
    telephone: string | null;
    email: string | null;
  } | null;
  lignes: LigneDevisBudget[];
}

export interface BudgetData {
  sejour: {
    titre: string;
    dateDebut: string;
    dateFin: string;
    placesTotales: number;
    createur?: {
      prenom: string;
      nom: string;
      email: string | null;
      telephone: string | null;
      etablissementNom: string | null;
      etablissementAdresse: string | null;
      etablissementVille: string | null;
      etablissementUai: string | null;
      etablissementEmail: string | null;
      etablissementTelephone: string | null;
    };
  } | null;
  devis: DevisBudget | null;
}

export async function getBudgetData(sejourId: string): Promise<BudgetData> {
  const { data } = await api.get<BudgetData>(`/collaboration/${sejourId}/budget`);
  return data;
}
