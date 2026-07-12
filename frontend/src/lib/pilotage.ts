import api from '@/src/lib/api';
import { downloadViaApi } from '@/src/lib/download';

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

export interface FacturesPdfPreview {
  total: number;
  avecPdf: number;
  // dateEmission : string ISO (sérialisation JSON), pas un objet Date
  sansPdf: Array<{ id: string; numero: string; dateEmission: string }>;
}

// Téléchargements via axios (downloadViaApi) : header X-Centre-Id posé par
// l'interceptor + erreurs backend remontées — un <a href> court-circuitait les deux.

export function exportFacturesCSV(dateDebut: string, dateFin: string): Promise<void> {
  return downloadViaApi(
    `/pilotage/export/factures?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `factures_LIAVO_${dateDebut}_${dateFin}.csv`,
  );
}

export function exportVersementsCSV(dateDebut: string, dateFin: string): Promise<void> {
  return downloadViaApi(
    `/pilotage/export/versements?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `versements_LIAVO_${dateDebut}_${dateFin}.csv`,
  );
}

export function exportFacturesZip(dateDebut: string, dateFin: string): Promise<void> {
  return downloadViaApi(
    `/pilotage/export/factures-pdf?dateDebut=${dateDebut}&dateFin=${dateFin}`,
    `factures_LIAVO_${dateDebut}_${dateFin}.zip`,
  );
}

export async function getFacturesPdfPreview(
  dateDebut: string,
  dateFin: string,
): Promise<FacturesPdfPreview> {
  const { data } = await api.get<FacturesPdfPreview>(
    `/pilotage/export/factures-pdf/preview?dateDebut=${dateDebut}&dateFin=${dateFin}`,
  );
  return data;
}
