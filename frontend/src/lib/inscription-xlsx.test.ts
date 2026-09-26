import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { fichierVersCsv, lireTamponModele } from './inscription-csv';

/**
 * Aller-retour Excel avec la bibliothèque réellement embarquée (xlsx, vendor/) :
 * un classeur construit comme modeleInscriptionXlsx (feuille « Inscriptions » +
 * feuille masquée « _liavo » tamponnée), puis relu par les fonctions d'import.
 * Garde-fou de la montée 0.18.5 → 0.20.3 : même API de lecture/écriture.
 */
function classeurModele(lignes: unknown[][], tampon: unknown): File {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes), 'Inscriptions');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[JSON.stringify(tampon)]]), '_liavo');
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([buf], 'modele-inscriptions.xlsx');
}

describe('import Excel (xlsx embarqué)', () => {
  const tampon = { v: 1, sejourId: 'sej-1', champsActifs: ['allergies', 'pointure'] };

  it('relit le tampon de la feuille masquée', async () => {
    const f = classeurModele([['Nom', 'Prénom']], tampon);
    await expect(lireTamponModele(f)).resolves.toEqual(tampon);
  });

  it('convertit la 1ʳᵉ feuille en CSV « ; » (accents, lignes vides ignorées, tampon exclu)', async () => {
    const f = classeurModele(
      [['Nom', 'Prénom', 'Allergies', 'Pointure'], ['DURAND', 'Léa', 'Arachides; pollen', 35], [], ['', '', '', '']],
      tampon,
    );
    const csv = await (await fichierVersCsv(f)).text();
    const lignes = csv.split('\n');
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toBe('Nom;Prénom;Allergies;Pointure');
    expect(lignes[1]).toContain('DURAND;Léa;');
    expect(lignes[1]).toContain('35');
    expect(csv).not.toContain('sejourId');
  });

  it('fichier sans tampon → null ; fichier non Excel → erreur', async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nom']]), 'Feuil1');
    const f = new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'x.xlsx');
    await expect(lireTamponModele(f)).resolves.toBeNull();
    await expect(fichierVersCsv(new File(['a;b'], 'x.csv'))).rejects.toThrow();
  });
});
