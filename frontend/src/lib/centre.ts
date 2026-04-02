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
  mandatFacturationAccepte?: boolean;
  mandatFacturationAccepteAt?: string | null;
  mandatFacturationVersion?: string | null;
  // Champs catalogue (alignement avec centres EN)
  accessiblePmr?: boolean;
  avisSecurite?: string | null;
  thematiquesCentre?: string[];
  activitesCentre?: string[];
  capaciteAdultes?: number | null;
  periodeOuverture?: string | null;
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
  capaciteParGroupe?: number | null;
  encadrementParGroupe?: number | null;
  simultaneitePossible?: boolean;
  dureeMinutes?: number | null;
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
  import('xlsx').then(XLSX => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nom', 'Type', 'Prix TTC (€)', 'TVA (%)', 'Prix HT (€)', 'Unité', 'Description'],
      ['Hébergement nuit',  'HEBERGEMENT', 49.50, 10, null, 'PAR_ELEVE', 'Nuitée en chambre partagée'],
      ['Forfait ski J1',    'ACTIVITE',    38.00,  0, null, 'PAR_ELEVE', 'Location matériel + remontées J1'],
      ['Repas midi',        'REPAS',       13.20, 10, null, 'PAR_ELEVE', ''],
      ['Transport aller',   'TRANSPORT',   16.50, 10, null, 'PAR_ELEVE', ''],
    ]);

    // Formules HT = TTC / (1 + TVA/100)
    ['E2','E3','E4','E5'].forEach((cell, i) => {
      const row = i + 2;
      ws[cell] = { t: 'n', f: `C${row}/(1+D${row}/100)`, z: '#,##0.00' };
    });

    ws['!cols'] = [
      { wch: 50 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 30 },
    ];

    XLSX.utils.sheet_add_aoa(ws, [
      ['--- VALEURS ACCEPTÉES ---'],
      ['Type:',     'HEBERGEMENT | REPAS | TRANSPORT | ACTIVITE | AUTRE'],
      ['Unité:',    'PAR_ELEVE | PAR_NUIT | PAR_JOUR | FORFAIT'],
      ['TVA (%):', '0 | 5.5 | 10 | 20'],
      ['Prix HT :', 'Calculé automatiquement — ne pas modifier cette colonne'],
    ], { origin: { r: 6, c: 0 } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Catalogue');
    XLSX.writeFile(wb, 'liavo_catalogue_template.xlsx');
  });
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

// ─── Contraintes centre ─────────────────────────────────────────────────────

export interface ContrainteCentre {
  id: string;
  libelle: string;
  type: string;
  jourSemaine: number | null;
  heureDebut: string | null;
  heureFin: string | null;
  actif: boolean;
  createdAt: string;
}

export async function getContraintesCentre(): Promise<ContrainteCentre[]> {
  const { data } = await api.get<ContrainteCentre[]>('/centres/contraintes-centre');
  return data;
}

export async function createContrainteCentre(dto: {
  libelle: string;
  type: string;
  jourSemaine?: number;
  heureDebut?: string;
  heureFin?: string;
}): Promise<ContrainteCentre> {
  const { data } = await api.post<ContrainteCentre>('/centres/contraintes-centre', dto);
  return data;
}

export async function deleteContrainteCentre(id: string): Promise<void> {
  await api.delete(`/centres/contraintes-centre/${id}`);
}

export async function updateCapacitesProduit(id: string, dto: {
  capaciteParGroupe?: number | null;
  encadrementParGroupe?: number | null;
  simultaneitePossible?: boolean;
  dureeMinutes?: number | null;
}): Promise<ProduitCatalogue> {
  const { data } = await api.patch<ProduitCatalogue>(`/centres/catalogue/${id}/capacites`, dto);
  return data;
}
