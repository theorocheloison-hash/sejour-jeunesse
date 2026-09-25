import * as XLSX from 'xlsx';
import { CLES_BLOC_B, CHAMP_PAR_CLE } from './champs-inscription';

/**
 * Source unique du FORMAT CSV des inscrits (export rempli, modèle vide) —
 * même contrat de colonnes que la grille de saisie : Bloc A fixe, Bloc B
 * actif en ordre canonique, contact fixe. Les libellés viennent de la
 * constante champs-inscription (reconnus par le mapping d'import du back).
 * Lecture des participants par clé, valeur brute (aucune logique d'affichage).
 */

export function colonnesInscription(
  champsActifs: string[],
): { key: string; label: string }[] {
  return [
    { key: 'eleveNom', label: 'Nom' },
    { key: 'elevePrenom', label: 'Prénom' },
    { key: 'eleveDateNaissance', label: 'Date de naissance' },
    ...CLES_BLOC_B.filter((k) => champsActifs.includes(k)).map((k) => ({
      key: CHAMP_PAR_CLE[k].colonne,
      label: CHAMP_PAR_CLE[k].libelle,
    })),
    // L'import back (detecterColonnesImport) n'attribue jamais une colonne
    // d'email ou de téléphone d'urgence au nom du parent : l'ordre de ces trois
    // colonnes est libre (plus de dépendance à l'ordre depuis le fix du 25/09).
    { key: 'nomParent', label: 'Nom du parent / responsable' },
    { key: 'telephoneUrgence', label: "Téléphone d'urgence" },
    { key: 'parentEmail', label: 'Email parent' },
  ];
}

// Guidage de valeurs pour les colonnes à liste — MODÈLE uniquement, jamais
// l'export ; les suffixes restent reconnus par le findCol du back (includes).
const GUIDAGE_MODELE: Record<string, string> = {
  hebergementCategorie: ' (Fille / Garçon)',
  niveauSki: ' (Débutant / Intermédiaire / Confirmé / Hors-piste)',
  attestationAquatique: ' (Fournie / Non fournie)',
};

function echapper(val: string): string {
  if (val.includes(';') || val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function telecharger(csv: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export rempli — séparateur ;, BOM UTF-8, date fr-FR, valeurs brutes.
 *  `clesRetenues` (optionnel) : sous-ensemble de colonnes à exporter (key) —
 *  absent = toutes les colonnes, comportement historique. */
export function exportInscriptionsCsv(
  participants: Array<Record<string, unknown>>,
  champsActifs: string[],
  titre: string,
  clesRetenues?: string[],
): void {
  const toutes = colonnesInscription(champsActifs);
  const columns = clesRetenues
    ? toutes.filter((c) => clesRetenues.includes(c.key))
    : toutes;
  const headerLine = columns.map((c) => c.label).join(';');
  const dataLines = participants.map((p) =>
    columns
      .map((c) => {
        const raw = p[c.key];
        let val: string;
        if (c.key === 'eleveDateNaissance') {
          val = raw ? new Date(String(raw)).toLocaleDateString('fr-FR') : '';
        } else {
          val = raw == null ? '' : String(raw);
        }
        return echapper(val);
      })
      .join(';'),
  );
  telecharger([headerLine, ...dataLines].join('\n'), `participants-${titre}.csv`);
}

/** Modèle vide .xlsx — en-têtes guidées, contact complet (nom parent + tél
 *  d'urgence + email — B2), zéro ligne.
 *  Tamponné pour CE séjour : feuille masquée « _liavo » (A1 = JSON {v, sejourId,
 *  champsActifs}) relue par lireTamponModele au réimport. 'Inscriptions' reste
 *  SheetNames[0] — fichierVersCsv (1ère feuille seule) est insensible au tampon. */
export function modeleInscriptionXlsx(sejourId: string, champsActifs: string[]): void {
  const headers = colonnesInscription(champsActifs).map(
    (c) => c.label + (GUIDAGE_MODELE[c.key] ?? ''),
  );
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(18, Math.min(44, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptions');
  const wsTampon = XLSX.utils.aoa_to_sheet([[JSON.stringify({ v: 1, sejourId, champsActifs })]]);
  XLSX.utils.book_append_sheet(wb, wsTampon, '_liavo');
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  XLSX.writeFile(wb, 'modele-inscriptions.xlsx');
}

export interface TamponModele {
  v: number;
  sejourId: string;
  champsActifs: string[];
}

/** Lit le tampon de la feuille masquée « _liavo ». null si absent/illisible. */
export async function lireTamponModele(file: File): Promise<TamponModele | null> {
  try {
    const wb = XLSX.read(await file.arrayBuffer());
    const cell = wb.Sheets['_liavo']?.['A1'];
    if (!cell?.v) return null;
    const t = JSON.parse(String(cell.v));
    if (typeof t?.sejourId !== 'string' || !Array.isArray(t?.champsActifs)) return null;
    return t;
  } catch {
    return null;
  }
}

/**
 * .xlsx/.xls → File .csv (séparateur ;, même échappement que l'export) pour le
 * parser back inchangé. PAS sheet_to_csv (virgule + guillemets RFC que le back
 * gère mal). Tout autre fichier est refusé (erreur) : l'unique appelant
 * (ImportCsvModal) n'y envoie que le modèle .xlsx/.xls déjà validé par lireTamponModele.
 */
export async function fichierVersCsv(file: File): Promise<File> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('fichierVersCsv : fichier Excel (.xlsx/.xls) attendu');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const lignes = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: false,
    dateNF: 'dd/mm/yyyy',
    defval: '',
  });
  const csv = lignes
    // Google Sheets exporte toute la plage utilisée (~1000 lignes) : une ligne
    // sans aucune donnée deviendrait « ;;;;;; » et gonflerait le compteur back.
    .filter((row) => row.some((v) => String(v ?? '').trim() !== ''))
    .map((row) => row.map((v) => echapper(String(v ?? ''))).join(';'))
    .join('\n');
  return new File([csv], file.name.replace(/\.(xlsx|xls)$/i, '.csv'), { type: 'text/csv' });
}
