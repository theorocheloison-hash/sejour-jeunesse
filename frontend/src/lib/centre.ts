import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  email: string;
  nomCentre: string;
  token: string;
  utilisedAt: string | null;
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
  description: string | null;
  imageUrl: string | null;
  statut: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  siret?: string | null;
  siteWeb?: string | null;
  tvaIntracommunautaire?: string | null;
  iban?: string | null;
  equipements?: string[];
  conditionsAnnulation?: string | null;
}

export interface Disponibilite {
  id: string;
  dateDebut: string;
  dateFin: string;
  capaciteDisponible: number;
  commentaire: string | null;
}

export interface DocumentCentre {
  id: string;
  type: 'AGREMENT' | 'ASSURANCE' | 'AUTRE';
  nom: string;
  dateExpiration: string | null;
  createdAt: string;
  url: string | null;
}

export interface RegisterCentreDto {
  token: string;
  password: string;
  nom: string;
  adresse: string;
  ville: string;
  codePostal: string;
  telephone?: string;
  capacite: number;
  description?: string;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function getInvitation(token: string): Promise<Invitation> {
  const { data } = await api.get<Invitation>(`/invitations/accept/${token}`);
  return data;
}

export async function registerCentre(dto: RegisterCentreDto) {
  const { data } = await api.post<{ access_token: string; user: { id: string; email: string; prenom: string; nom: string; role: string }; centre: Centre }>('/centres/register', dto);
  return data;
}

export async function getMonProfil(): Promise<Centre> {
  const { data } = await api.get<Centre>('/centres/mon-profil');
  return data;
}

export async function updateMonProfil(dto: Partial<Centre>): Promise<Centre> {
  const { data } = await api.patch<Centre>('/centres/mon-profil', dto);
  return data;
}

export async function getDisponibilites(): Promise<Disponibilite[]> {
  const { data } = await api.get<Disponibilite[]>('/centres/disponibilites');
  return data;
}

export async function createDisponibilite(dto: {
  dateDebut: string;
  dateFin: string;
  capaciteDisponible: number;
  commentaire?: string;
}): Promise<Disponibilite> {
  const { data } = await api.post<Disponibilite>('/centres/disponibilites', dto);
  return data;
}

export async function deleteDisponibilite(id: string): Promise<void> {
  await api.delete(`/centres/disponibilites/${id}`);
}

export async function getDocuments(): Promise<DocumentCentre[]> {
  const { data } = await api.get<DocumentCentre[]>('/centres/documents');
  return data;
}

export async function createDocument(dto: {
  type: 'AGREMENT' | 'ASSURANCE' | 'AUTRE';
  nom: string;
  dateExpiration?: string;
}): Promise<DocumentCentre> {
  const { data } = await api.post<DocumentCentre>('/centres/documents', dto);
  return data;
}

export async function uploadCentreImage(file: File): Promise<Centre> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<Centre>('/centres/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ─── Catalogue produits ─────────────────────────────────────────────────────

export interface ProduitCatalogue {
  id: string;
  nom: string;
  description?: string | null;
  type: 'HEBERGEMENT' | 'REPAS' | 'TRANSPORT' | 'ACTIVITE' | 'AUTRE';
  prixUnitaireHT: number;
  prixUnitaireTTC?: number | null;
  tva: number;
  unite: 'PAR_ELEVE' | 'PAR_NUIT' | 'PAR_JOUR' | 'FORFAIT';
  actif: boolean;
  createdAt: string;
}

export async function getCatalogue(): Promise<ProduitCatalogue[]> {
  const { data } = await api.get<ProduitCatalogue[]>('/centres/catalogue');
  return data;
}

export async function createProduit(dto: Omit<ProduitCatalogue, 'id' | 'actif' | 'createdAt'>): Promise<ProduitCatalogue> {
  const { data } = await api.post<ProduitCatalogue>('/centres/catalogue', dto);
  return data;
}

export async function updateProduit(id: string, dto: Partial<Omit<ProduitCatalogue, 'id' | 'actif' | 'createdAt'>>): Promise<ProduitCatalogue> {
  const { data } = await api.patch<ProduitCatalogue>(`/centres/catalogue/${id}`, dto);
  return data;
}

export async function archiveProduit(id: string): Promise<void> {
  await api.delete(`/centres/catalogue/${id}`);
}

export function downloadTemplateCatalogue(): void {
  const header = ['Nom', 'Type', 'Prix HT (€)', 'TVA (%)', 'Unité', 'Description'];
  const exemples = [
    ['Hébergement nuit', 'HEBERGEMENT', '45', '10', 'PAR_ELEVE', 'Nuitée en chambre partagée'],
    ['Forfait ski J1', 'ACTIVITE', '38', '10', 'PAR_ELEVE', 'Location matériel + remontées J1'],
    ['Repas midi', 'REPAS', '12', '10', 'PAR_ELEVE', ''],
    ['Transport aller', 'TRANSPORT', '15', '10', 'PAR_ELEVE', ''],
  ];
  const notice = [
    ['--- VALEURS ACCEPTÉES ---', '', '', '', '', ''],
    ['Type:', 'HEBERGEMENT | REPAS | TRANSPORT | ACTIVITE | AUTRE', '', '', '', ''],
    ['Unité:', 'PAR_ELEVE | PAR_NUIT | PAR_JOUR | FORFAIT', '', '', '', ''],
    ['TVA (%):', '0 | 5.5 | 10 | 20', '', '', '', ''],
  ];
  const rows = [header, ...exemples, [''], ...notice];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'liavo_catalogue_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProduitsCatalogue(
  produits: Omit<ProduitCatalogue, 'id' | 'actif' | 'createdAt'>[]
): Promise<{ imported: number; total: number }> {
  const { data } = await api.post<{ imported: number; total: number }>('/centres/catalogue/import', { produits });
  return data;
}

// ─── Upload documents ───────────────────────────────────────────────────────

export async function uploadCentreDocument(dto: {
  type: 'AGREMENT' | 'ASSURANCE' | 'AUTRE';
  nom: string;
  dateExpiration?: string;
}, file: File): Promise<DocumentCentre> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', dto.type);
  formData.append('nom', dto.nom);
  if (dto.dateExpiration) formData.append('dateExpiration', dto.dateExpiration);
  const { data } = await api.post<DocumentCentre>('/centres/documents-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
