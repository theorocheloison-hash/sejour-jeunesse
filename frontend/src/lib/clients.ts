import api from './api';

export const STATUT_CLIENT_LABELS: Record<string, { label: string; cls: string }> = {
  PROSPECT:       { label: 'Prospect',        cls: 'bg-gray-100 text-gray-600' },
  CONTACTE:       { label: 'Contact\u00e9',   cls: 'bg-blue-100 text-blue-700' },
  INTERESSE:      { label: 'Int\u00e9ress\u00e9', cls: 'bg-amber-100 text-amber-700' },
  EN_NEGOCIATION: { label: 'En n\u00e9gociation', cls: 'bg-orange-100 text-orange-700' },
  CLIENT:         { label: 'Client',           cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  INACTIF:        { label: 'Inactif',          cls: 'bg-gray-100 text-gray-400' },
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
  createdAt: string;
  contacts: ContactClient[];
  rappels: Rappel[];
  sejours: SejourClient[];
}

export const getMesClients = () => api.get<Client[]>('/clients').then(r => r.data);
export const getClient = (id: string) => api.get<Client>(`/clients/${id}`).then(r => r.data);
export const createClient = (dto: Partial<Client>) => api.post<Client>('/clients', dto).then(r => r.data);
export const updateClient = (id: string, dto: Partial<Client>) => api.patch<Client>(`/clients/${id}`, dto).then(r => r.data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
export const addContact = (clientId: string, dto: Partial<ContactClient>) => api.post<ContactClient>(`/clients/${clientId}/contacts`, dto).then(r => r.data);
export const deleteContact = (id: string) => api.delete(`/clients/contacts/${id}`);
export const addRappel = (clientId: string, dto: { type: string; dateEcheance: string; description: string }) => api.post<Rappel>(`/clients/${clientId}/rappels`, dto).then(r => r.data);
export const updateRappelStatut = (id: string, statut: string) => api.patch<Rappel>(`/clients/rappels/${id}/statut`, { statut }).then(r => r.data);
export const deleteRappel = (id: string) => api.delete(`/clients/rappels/${id}`);
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
