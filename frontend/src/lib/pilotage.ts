import api from '@/src/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MoisRemplissage {
  mois: number;
  taux: number;
  nuiteesOccupees: number;
  nuiteesDisponibles: number;
  nbSejours: number;
}

export interface RemplissageData {
  annee: number;
  capacite: number;
  tauxAnnuel: number;
  nuiteesOccupees: number;
  nuiteesDisponibles: number;
  parMois: MoisRemplissage[];
  comparaisonN1: { tauxAnnuel: number; evolution: string } | null;
}

export interface MoisCA {
  mois: number;
  confirme: number;
  encaisse: number;
}

export interface CAData {
  annee: number;
  confirme: number;
  encaisse: number;
  resteAEncaisser: number;
  parMois: MoisCA[];
  parType: { sejours: number; evenements: number };
  parSource: { direct: number; reseau: number };
  parProduit: { nom: string; type: string | null; total: number }[];
  comparaisonN1: { confirme: number; evolution: string } | null;
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function getRemplissage(annee: number): Promise<RemplissageData> {
  const { data } = await api.get<RemplissageData>(`/pilotage/remplissage?annee=${annee}`);
  return data;
}

export async function getCA(annee: number): Promise<CAData> {
  const { data } = await api.get<CAData>(`/pilotage/ca?annee=${annee}`);
  return data;
}

export function exportFacturesURL(dateDebut: string, dateFin: string): string {
  return `/api/pilotage/export/factures?dateDebut=${dateDebut}&dateFin=${dateFin}`;
}

export function exportVersementsURL(dateDebut: string, dateFin: string): string {
  return `/api/pilotage/export/versements?dateDebut=${dateDebut}&dateFin=${dateFin}`;
}
