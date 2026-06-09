import api from './api';

// Statuts legacy en base (Client.statut) \u2014 conserv\u00e9s pour l'import CSV historique
export const STATUT_CLIENT_LABELS: Record<string, { label: string; cls: string }> = {
  PROSPECT:       { label: 'Prospect',        cls: 'bg-gray-100 text-gray-600' },
  CONTACTE:       { label: 'Contact\u00e9',   cls: 'bg-blue-100 text-blue-700' },
  INTERESSE:      { label: 'Int\u00e9ress\u00e9', cls: 'bg-amber-100 text-amber-700' },
  EN_NEGOCIATION: { label: 'En n\u00e9gociation', cls: 'bg-orange-100 text-orange-700' },
  CLIENT:         { label: 'Client',           cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  INACTIF:        { label: 'Inactif',          cls: 'bg-gray-100 text-gray-400' },
  PERDU:          { label: 'Perdu',            cls: 'bg-red-100 text-red-600' },
};

// Statuts d\u00e9riv\u00e9s automatiquement du devis le plus avanc\u00e9 (pipeline CRM)
export const STATUT_DERIVE_LABELS: Record<string, { label: string; cls: string }> = {
  PROSPECT:       { label: 'Prospect',        cls: 'bg-gray-100 text-gray-600' },
  EN_COURS:       { label: 'En cours',        cls: 'bg-blue-100 text-blue-700' },
  DEVIS_ENVOYE:   { label: 'Devis envoy\u00e9',    cls: 'bg-amber-100 text-amber-700' },
  CONFIRME:       { label: 'Confirm\u00e9',         cls: 'bg-indigo-100 text-indigo-700' },
  ACOMPTE_VERSE:  { label: 'Acompte vers\u00e9',   cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  SOLDE:          { label: 'Sold\u00e9',            cls: 'bg-gray-100 text-gray-500' },
  PERDU:          { label: 'Perdu',            cls: 'bg-red-100 text-red-600' },
};

export const TYPE_CLIENT_LABELS: Record<string, string> = {
  ETABLISSEMENT_SCOLAIRE: '\u00c9tablissement scolaire',
  COLLEGE: 'Coll\u00e8ge',
  LYCEE: 'Lyc\u00e9e',
  ECOLE: '\u00c9cole',
  COLONIE: 'Colonie de vacances',
  CE: 'Comit\u00e9 d\'entreprise',
  ASSOCIATION: 'Association',
  PARTICULIER: 'Particulier',
  AUTRE: 'Autre',
};

export const RAPPEL_TYPE_LABELS: Record<string, string> = {
  TELEPHONE:     'Appel t\u00e9l\u00e9phonique',
  EMAIL:         'Email',
  RELANCE_DEVIS: 'Relance devis',
  VISITE:        'Visite',
  AUTRE:         'Autre',
};

export const ACADEMIES = [
  'Aix-Marseille','Amiens','Besan\u00e7on','Bordeaux','Caen','Clermont-Ferrand',
  'Corse','Cr\u00e9teil','Dijon','Grenoble','Guadeloupe','Guyane','La Martinique',
  'La R\u00e9union','Lille','Limoges','Lyon','Mayotte','Montpellier','Nancy-Metz',
  'Nantes','Nice','Normandie','Orl\u00e9ans-Tours','Paris','Poitiers','Reims',
  'Rennes','Rouen','Strasbourg','Toulouse','Versailles',
];

export interface ContactClient {
  id: string;
  prenom: string;
  nom: string;
  email?: string | null;
  telephone?: string | null;
  role?: string | null;
  notes?: string | null;
}

export interface Rappel {
  id: string;
  type: string;
  dateEcheance: string;
  description: string;
  statut: string;
  createdAt: string;
}

export interface SejourClient {
  id: string;
  sejourId: string;
  sejour?: {
    id: string;
    titre: string;
    statut: string;
    dateDebut: string | null;
    dateFin: string | null;
    natureSejour?: string;
    modeGestion?: string;
  } | null;
}

export interface DevisClient {
  id: string;
  numeroDevis?: string | null;
  numeroFacture?: string | null;
  typeDocument: string;
  statut: string;
  isComplementaire?: boolean;
  montantTotal: string;
  montantTTC?: number | null;
  montantAcompte?: number | null;
  montantSolde?: number | null;
  acompteVerse: boolean;
  dateFacture?: string | null;
  createdAt: string;
  factures?: Array<{
    id: string;
    typeFacture: 'ACOMPTE' | 'SOLDE' | 'AVOIR';
    numero: string;
    montantFacture: number;
    acompteVerse: boolean;
  }> | null;
  demande?: {
    sejourId: string;
    sejour?: { titre: string; dateDebut: string; dateFin: string } | null;
  } | null;
}

export interface Client {
  id: string;
  nom: string;
  type: string;
  statut: string;
  adresse?: string | null;
  ville?: string | null;
  codePostal?: string | null;
  telephone?: string | null;
  email?: string | null;
  uai?: string | null;
  academie?: string | null;
  notes?: string | null;
  source: string;
  organisationId?: string | null;
  createdAt: string;
  contacts: ContactClient[];
  rappels: Rappel[];
  sejours: SejourClient[];
  devis: DevisClient[];
  montantCA?: number;
  nombreSejours?: number;
}

/**
 * Dérive le statut pipeline d'un client à partir du devis le plus avancé
 * parmi ses séjours. L'override manuel "PERDU" (Client.statut) prime tant
 * qu'aucun dossier actif n'existe.
 */
export function deriveClientStatus(client: Client): string {
  // Override PERDU manuel : seulement si aucun dossier actif
  const hasActiveDossier = client.sejours.some(s => {
    const statut = s.sejour?.statut;
    return statut && !['DRAFT'].includes(statut);
  });
  if (client.statut === 'PERDU' && !hasActiveDossier) return 'PERDU';

  // Seuls les devis PRINCIPAUX pilotent le statut CRM.
  // Les complémentaires (AS, Mairie, CE) sont des prestations additionnelles
  // qui ne reflètent pas l'avancement de la relation commerciale principale.
  // Défensif : !undefined === true → les anciens enregistrements (sans le champ) passent.
  const devisPrincipaux = client.devis.filter(d => !d.isComplementaire);

  const devisStatuts = devisPrincipaux.map(d => d.statut);
  // Lot 1 : la facturation vient des Factures liées (le devis ne mute plus vers FACTURE_*).
  // Repli legacy : ancien typeDocument FACTURE_* (données antérieures au Lot 1).
  const aFactureType = (d: DevisClient, type: 'ACOMPTE' | 'SOLDE') =>
    (d.factures ?? []).some(f => f.typeFacture === type)
    || d.typeDocument === `FACTURE_${type}`;
  const devisAvecSolde = devisPrincipaux.some(d => aFactureType(d, 'SOLDE'));
  const devisAvecAcompte = devisPrincipaux.some(d => aFactureType(d, 'ACOMPTE'));

  // Du plus avancé au moins avancé
  if (devisAvecSolde) {
    // Tous soldés ou non retenus → Soldé ; sinon le statut actif prime (plus bas)
    const activeDevis = devisPrincipaux.filter(d => !aFactureType(d, 'SOLDE') && d.statut !== 'NON_RETENU');
    if (activeDevis.length === 0) return 'SOLDE';
  }
  if (devisAvecAcompte) return 'ACOMPTE_VERSE';
  if (devisStatuts.some(s => s === 'SELECTIONNE' || s === 'SIGNE_DIRECTION')) return 'CONFIRME';
  if (devisStatuts.some(s => s === 'EN_ATTENTE' || s === 'EN_ATTENTE_VALIDATION')) return 'DEVIS_ENVOYE';

  // Devis présents mais tous non retenus → Perdu
  if (devisStatuts.length > 0 && devisStatuts.every(s => s === 'NON_RETENU')) return 'PERDU';

  // Des séjours existent (OPTION ou plus) sans devis pertinent → En cours
  if (client.sejours.length > 0) return 'EN_COURS';

  return 'PROSPECT';
}

export interface RappelToday {
  id: string;
  type: string;
  dateEcheance: string;
  description: string;
  statut: string;
  client: { id: string; nom: string };
}

export const getMesClients = () => api.get<Client[]>('/clients').then(r => r.data);

export const getRappelsToday = () =>
  api.get<RappelToday[]>('/clients/rappels/today').then(r => r.data);

export interface EtablissementEN {
  uai: string;
  nom: string;
  type: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  academie: string | null;
}

export const searchEtablissement = (q: string) =>
  api.get<EtablissementEN[]>('/clients/search-etablissement', { params: { q } }).then(r => r.data);

export const getClient = (id: string) => api.get<Client>(`/clients/${id}`).then(r => r.data);
export const createClient = (dto: Partial<Client>) => api.post<Client>('/clients', dto).then(r => r.data);
export const updateClient = (id: string, dto: Partial<Client>) => api.patch<Client>(`/clients/${id}`, dto).then(r => r.data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
export const addContact = (clientId: string, dto: Partial<ContactClient>) => api.post<ContactClient>(`/clients/${clientId}/contacts`, dto).then(r => r.data);
export const deleteContact = (id: string) => api.delete(`/clients/contacts/${id}`);
export const addRappel = (clientId: string, dto: { type: string; dateEcheance: string; description: string }) => api.post<Rappel>(`/clients/${clientId}/rappels`, dto).then(r => r.data);
export const updateRappelStatut = (id: string, statut: string) => api.patch<Rappel>(`/clients/rappels/${id}/statut`, { statut }).then(r => r.data);
export const deleteRappel = (id: string) => api.delete(`/clients/rappels/${id}`);
export async function rattacherSejour(clientId: string, sejourId: string): Promise<void> {
  await api.post(`/clients/${clientId}/sejours/${sejourId}`);
}
export const importerProspects = (academie: string, types: string[]) => api.post<{ imported: number; skipped: number; total: number }>('/clients/import/prospects', { academie, types }).then(r => r.data);

export function downloadTemplateClients(): void {
  const header = ['Nom', 'Type', 'Statut', 'Ville', 'Code postal', 'Téléphone', 'Email', 'UAI', 'Notes'];
  const exemples = [
    ['Collège Victor Hugo', 'COLLEGE', 'PROSPECT', 'Paris', '75001', '0144556677', 'contact@college-hugo.fr', '0750001A', ''],
    ['Lycée Jean Moulin', 'LYCEE', 'CONTACTE', 'Lyon', '69003', '0472334455', '', '0690042B', 'Intéressé par séjours ski'],
    ['École primaire les Lilas', 'ECOLE', 'PROSPECT', 'Bordeaux', '33000', '', '', '', ''],
    ['CE Airbus', 'CE', 'PROSPECT', 'Toulouse', '31300', '0561001122', 'ce@airbus.fr', '', 'Groupe adultes été'],
  ];
  const notice = [
    [''],
    ['--- VALEURS ACCEPTÉES ---', '', '', '', '', '', '', '', ''],
    ['Type:', 'ETABLISSEMENT_SCOLAIRE | COLLEGE | LYCEE | ECOLE | COLONIE | CE | ASSOCIATION | AUTRE', '', '', '', '', '', '', ''],
    ['Statut:', 'PROSPECT | CONTACTE | INTERESSE | EN_NEGOCIATION | CLIENT | INACTIF | PERDU', '', '', '', '', '', '', ''],
    ['UAI:', 'Code UAI établissement (ex: 0750001A) — optionnel, évite les doublons', '', '', '', '', '', '', ''],
  ];
  const rows = [header, ...exemples, ...notice];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'liavo_clients_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importerClientsCSV(
  lignes: Array<Record<string, string>>
): Promise<{ imported: number; skipped: number; total: number }> {
  const { data } = await api.post<{ imported: number; skipped: number; total: number }>(
    '/clients/import/csv',
    { lignes }
  );
  return data;
}

export function downloadTemplateContacts(): void {
  const header = ['Établissement', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Rôle'];
  const exemples = [
    ['Collège Victor Hugo', 'Marie', 'DUPONT', 'marie.dupont@college-hugo.fr', '06 12 34 56 78', 'Enseignante référente'],
    ['Collège Victor Hugo', 'Jean', 'MARTIN', 'jean.martin@college-hugo.fr', '', 'Directeur'],
    ['CE Airbus', 'Sophie', 'LAMBERT', 'sophie.lambert@airbus.fr', '06 99 88 77 66', 'Responsable CE'],
    ['Camilla MURRAY', 'Camilla', 'MURRAY', 'camilla.murray92@gmail.com', '06 11 22 33 44', 'Particulier'],
  ];
  const notice = [
    [''],
    ['--- IMPORTANT ---', '', '', '', '', ''],
    ['Établissement:', 'Doit correspondre exactement au nom du client dans LIAVO', '', '', '', ''],
    ['Prénom + Nom:', 'Au moins l\'un des deux est obligatoire', '', '', '', ''],
    ['Email:', 'Utilisé pour éviter les doublons', '', '', '', ''],
    ['Rôle:', 'Libre — ex: Enseignant, Directeur, Responsable CE, Particulier', '', '', '', ''],
  ];
  const rows = [header, ...exemples, ...notice];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'liavo_contacts_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importerContactsCSV(
  lignes: Array<Record<string, string>>
): Promise<{ imported: number; skipped: number; clientNotFound: number; total: number }> {
  const { data } = await api.post<{ imported: number; skipped: number; clientNotFound: number; total: number }>(
    '/clients/import/contacts',
    { lignes }
  );
  return data;
}

export interface ActiviteClient {
  id: string;
  clientId: string;
  centreId: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  createdAt: string;
}

export async function getActivitesClient(clientId: string): Promise<ActiviteClient[]> {
  const { data } = await api.get<ActiviteClient[]>(`/clients/${clientId}/activites`);
  return data;
}

export async function createActiviteClient(
  clientId: string,
  dto: { type: string; description: string; metadata?: Record<string, unknown> }
): Promise<ActiviteClient> {
  const { data } = await api.post<ActiviteClient>(`/clients/${clientId}/activites`, dto);
  return data;
}

export async function envoyerBrochureClient(clientId: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>(`/clients/${clientId}/envoyer-brochure`);
  return data;
}
