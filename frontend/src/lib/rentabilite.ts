import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface VentilationSejour {
  id: string;
  factureId: string;
  sejourId: string;
  montantTTC: number;
  createdAt: string;
}

export interface FacturePrestataire {
  id: string;
  centreId: string;
  nomPrestataire: string;
  typeCharge: string;
  numeroFacture?: string | null;
  dateFacture?: string | null;
  montantTotalTTC: number;
  fichierUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  ventilations: VentilationSejour[];
}

export interface LigneRentabilite {
  sejourId: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  natureSejour: string;
  caTTC: number;
  chargesTTC: number;
  margeTTC: number;
  tauxMarge: number | null;
  nbVentilations: number;
}

export interface TableauRentabilite {
  sejours: LigneRentabilite[];
  totaux: {
    caTTC: number;
    chargesTTC: number;
    margeTTC: number;
    tauxMarge: number | null;
  };
}

export interface CreateVentilationDto {
  sejourId: string;
  montantTTC: number;
}

export interface CreateFacturePrestatireDto {
  nomPrestataire: string;
  typeCharge: string;
  numeroFacture?: string;
  dateFacture?: string;
  montantTotalTTC: number;
  notes?: string;
  ventilations: CreateVentilationDto[];
}

// ─── Fonctions API ───────────────────────────────────────────────────────────

export async function getTableauRentabilite(params?: {
  mois?: string; // format 'YYYY-MM'
  annee?: string; // format 'YYYY'
}): Promise<TableauRentabilite> {
  const qs = new URLSearchParams();
  if (params?.mois) qs.set('mois', params.mois);
  else if (params?.annee) qs.set('annee', params.annee);
  const r = await api.get(`/rentabilite/tableau?${qs.toString()}`);
  return r.data;
}

export async function getMesFacturesPrestataires(): Promise<FacturePrestataire[]> {
  const r = await api.get('/rentabilite/factures');
  return r.data;
}

export async function createFacturePrestataire(
  dto: CreateFacturePrestatireDto
): Promise<FacturePrestataire> {
  const r = await api.post('/rentabilite/factures', dto);
  return r.data;
}

export async function updateFacturePrestataire(
  id: string,
  dto: CreateFacturePrestatireDto
): Promise<FacturePrestataire> {
  const r = await api.patch(`/rentabilite/factures/${id}`, dto);
  return r.data;
}

export async function deleteFacturePrestataire(id: string): Promise<void> {
  await api.delete(`/rentabilite/factures/${id}`);
}

export async function uploadFichierFacturePrestataire(
  id: string,
  file: File
): Promise<{ fichierUrl: string }> {
  const fd = new FormData();
  fd.append('document', file);
  const r = await api.post(`/rentabilite/factures/${id}/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return r.data;
}
