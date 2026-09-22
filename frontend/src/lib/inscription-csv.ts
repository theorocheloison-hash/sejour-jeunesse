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
  contactComplet = true,
): { key: string; label: string }[] {
  return [
    { key: 'eleveNom', label: 'Nom' },
    { key: 'elevePrenom', label: 'Prénom' },
    { key: 'eleveDateNaissance', label: 'Date de naissance' },
    ...CLES_BLOC_B.filter((k) => champsActifs.includes(k)).map((k) => ({
      key: CHAMP_PAR_CLE[k].colonne,
      label: CHAMP_PAR_CLE[k].libelle,
    })),
    // contactComplet=false (modèle) : nom/tél parent omis — le parent les
    // renseignera via son formulaire ; l'export garde le contact complet.
    ...(contactComplet
      ? [
          { key: 'nomParent', label: 'Nom du parent / responsable' },
          { key: 'telephoneUrgence', label: "Téléphone d'urgence" },
        ]
      : []),
    // Modèle : « Email » sans « parent » — sinon le colNomParent du back
    // (findCol par includes) capterait cette colonne et y rangerait l'email.
    { key: 'parentEmail', label: contactComplet ? 'Email parent' : 'Email' },
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

/** Modèle vide .xlsx — en-têtes guidées (contact réduit à l'email), zéro ligne. */
export function modeleInscriptionXlsx(champsActifs: string[]): void {
  const headers = colonnesInscription(champsActifs, false).map(
    (c) => c.label + (GUIDAGE_MODELE[c.key] ?? ''),
  );
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(18, Math.min(44, h.length + 2)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptions');
  XLSX.writeFile(wb, 'modele-inscriptions.xlsx');
}

/**
 * .xlsx/.xls → File .csv (séparateur ;, même échappement que l'export) pour le
 * parser back inchangé. PAS sheet_to_csv (virgule + guillemets RFC que le back
 * gère mal). Tout autre fichier repart inchangé.
 */
export async function fichierVersCsv(file: File): Promise<File> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) return file;
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
    .map((row) => row.map((v) => echapper(String(v ?? ''))).join(';'))
    .join('\n');
  return new File([csv], file.name.replace(/\.(xlsx|xls)$/i, '.csv'), { type: 'text/csv' });
}
