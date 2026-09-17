import { CLES_BLOC_B, CHAMP_PAR_CLE } from './champs-inscription';

/**
 * Source unique du FORMAT CSV des inscrits (export rempli, modèle vide) —
 * même contrat de colonnes que la grille de saisie : Bloc A fixe, Bloc B
 * actif en ordre canonique, contact fixe. Les libellés viennent de la
 * constante champs-inscription (reconnus par le mapping d'import du back).
 * Lecture des participants par clé, valeur brute (aucune logique d'affichage).
 */

export function colonnesInscription(champsActifs: string[]): { key: string; label: string }[] {
  return [
    { key: 'eleveNom', label: 'Nom' },
    { key: 'elevePrenom', label: 'Prénom' },
    { key: 'eleveDateNaissance', label: 'Date de naissance' },
    ...CLES_BLOC_B.filter((k) => champsActifs.includes(k)).map((k) => ({
      key: CHAMP_PAR_CLE[k].colonne,
      label: CHAMP_PAR_CLE[k].libelle,
    })),
    { key: 'nomParent', label: 'Nom du parent / responsable' },
    { key: 'telephoneUrgence', label: "Téléphone d'urgence" },
    { key: 'parentEmail', label: 'Email parent' },
  ];
}

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

/** Export rempli — séparateur ;, BOM UTF-8, date fr-FR, valeurs brutes. */
export function exportInscriptionsCsv(
  participants: Array<Record<string, unknown>>,
  champsActifs: string[],
  titre: string,
): void {
  const columns = colonnesInscription(champsActifs);
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

/** Modèle vide — même en-tête que l'export, zéro ligne. */
export function modeleInscriptionCsv(champsActifs: string[]): void {
  const headerLine = colonnesInscription(champsActifs)
    .map((c) => c.label)
    .join(';');
  telecharger(headerLine, 'modele-inscriptions.csv');
}
