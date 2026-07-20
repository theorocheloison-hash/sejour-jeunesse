// Tests de caractérisation du moteur financier frontend (§4.9).
// Convention métier (RÈGLE 4) : l'utilisateur saisit des prix TTC ; le HT est
// dérivé et c'est le PU HT qui est stocké. Le TTC-first est l'invariant : les
// totaux TTC dérivent du PU TTC saisi, jamais du HT arrondi.
import { describe, it, expect } from 'vitest';
import {
  round2,
  resolvePrixCatalogueTTC,
  formatMontant,
  mapLignesForApi,
  calculerTotaux,
  type LigneFormInput,
} from './devis-calculs';
import type { ProduitCatalogue } from '@/src/lib/centre';

const produit = (over: Partial<ProduitCatalogue> = {}): ProduitCatalogue => ({
  id: 'p1',
  nom: 'Pension complète',
  type: 'HEBERGEMENT',
  prixUnitaireHT: 100,
  prixUnitaireTTC: null,
  tva: 10,
  unite: 'PAR_ELEVE',
  actif: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const ligne = (over: Partial<LigneFormInput> = {}): LigneFormInput => ({
  description: 'Pension complète',
  quantite: '1',
  prixUnitaire: '110', // PU TTC saisi
  tva: '10',
  ...over,
});

describe('round2', () => {
  it('arrondit à 2 décimales', () => {
    expect(round2(1.005 + 1)).toBe(2.01);
    expect(round2(12312.800000000001)).toBe(12312.8);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('conserve les négatifs signés (avoirs)', () => {
    expect(round2(-1234.567)).toBe(-1234.57);
  });
});

describe('resolvePrixCatalogueTTC', () => {
  it('prend prixUnitaireTTC quand il est renseigné', () => {
    expect(resolvePrixCatalogueTTC(produit({ prixUnitaireTTC: 123.45 }))).toBe(123.45);
  });

  it('dérive du HT + TVA sinon (arrondi 2 déc.)', () => {
    expect(resolvePrixCatalogueTTC(produit({ prixUnitaireHT: 100, tva: 10, prixUnitaireTTC: null }))).toBe(110);
    // 33.33 × 1.20 = 39.996 → 40.00
    expect(resolvePrixCatalogueTTC(produit({ prixUnitaireHT: 33.33, tva: 20, prixUnitaireTTC: null }))).toBe(40);
  });
});

describe('formatMontant', () => {
  // fr-FR insère une espace insécable (étroite) comme séparateur de milliers —
  // on normalise pour rendre le test insensible à la variante ICU.
  const norm = (s: string) => s.replace(/[  ]/g, ' ');

  it('formate avec 2 décimales et séparateur de milliers', () => {
    expect(norm(formatMontant(12312.8))).toBe('12 312,80');
    expect(norm(formatMontant(0))).toBe('0,00');
  });
});

describe('mapLignesForApi', () => {
  it('dérive le PU HT du PU TTC saisi et stocke le HT (RÈGLE 4)', () => {
    const [l] = mapLignesForApi([ligne({ quantite: '10', prixUnitaire: '120', tva: '10' })]);
    expect(l.prixUnitaire).toBe(109.09); // 120 / 1.10 arrondi
    expect(l.totalTTC).toBe(1200); // TTC-first : PU TTC × qté
    expect(l.totalHT).toBe(1090.9); // PU HT arrondi × qté, ré-arrondi
    expect(l.tva).toBe(10);
    expect(l.quantite).toBe(10);
  });

  it('TVA 0 → PU HT = PU TTC', () => {
    const [l] = mapLignesForApi([ligne({ prixUnitaire: '250', tva: '0' })]);
    expect(l.prixUnitaire).toBe(250);
    expect(l.totalHT).toBe(250);
    expect(l.totalTTC).toBe(250);
  });

  it('le TTC ligne reste exact même quand le HT arrondi divergerait (TTC-first)', () => {
    // 3.33 TTC / 1.10 → HT 3.03 ; ×3 : HT 9.09, TTC 9.99 (pas 9.09 × 1.10 = 10.00)
    const [l] = mapLignesForApi([ligne({ quantite: '3', prixUnitaire: '3.33', tva: '10' })]);
    expect(l.totalTTC).toBe(9.99);
    expect(l.totalHT).toBe(9.09);
  });

  it('ignore les lignes sans description (y compris espaces seuls)', () => {
    const res = mapLignesForApi([
      ligne({ description: '' }),
      ligne({ description: '   ' }),
      ligne({ description: 'Gardée' }),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].description).toBe('Gardée');
  });

  it('saisies non numériques → 0 (parseFloat tolérant)', () => {
    const [l] = mapLignesForApi([ligne({ quantite: 'abc', prixUnitaire: '', tva: 'x' })]);
    expect(l.quantite).toBe(0);
    expect(l.prixUnitaire).toBe(0);
    expect(l.totalHT).toBe(0);
    expect(l.totalTTC).toBe(0);
  });

  it('ligne option (qty 0) : totaux à 0, PU conservé', () => {
    const [l] = mapLignesForApi([ligne({ quantite: '0', prixUnitaire: '250', tva: '10' })]);
    expect(l.quantite).toBe(0);
    expect(l.prixUnitaire).toBe(227.27);
    expect(l.totalHT).toBe(0);
    expect(l.totalTTC).toBe(0);
  });
});

describe('calculerTotaux', () => {
  it('agrège HT/TTC ligne à ligne et dérive la TVA (TTC − HT)', () => {
    const totaux = calculerTotaux(
      [
        ligne({ quantite: '10', prixUnitaire: '120', tva: '10' }), // HT 1090.9, TTC 1200
        ligne({ quantite: '2', prixUnitaire: '60', tva: '20' }), // HT 100, TTC 120
      ],
      30,
    );
    expect(totaux.montantHT).toBe(1190.9);
    expect(totaux.montantTTC).toBe(1320);
    expect(totaux.montantTVA).toBe(129.1); // dérivée, jamais recalculée par taux
    expect(totaux.montantAcompte).toBe(396); // 30 % de 1320
    expect(totaux.resteAPayer).toBe(924);
    expect(totaux.montantAcompte + totaux.resteAPayer).toBe(totaux.montantTTC);
  });

  it('neutralise l’artéfact float des sommes déjà arrondies (cas du commentaire du module)', () => {
    // 4112.50 + 8200.30 = 12312.800000000001 en float brut
    const totaux = calculerTotaux(
      [
        ligne({ quantite: '1', prixUnitaire: '4112.50', tva: '0' }),
        ligne({ quantite: '1', prixUnitaire: '8200.30', tva: '0' }),
      ],
      0,
    );
    expect(totaux.montantTTC).toBe(12312.8);
    expect(totaux.montantHT).toBe(12312.8);
    expect(totaux.montantTVA).toBe(0);
  });

  it('acompte arrondi au centime, reste complémentaire au centime', () => {
    const totaux = calculerTotaux([ligne({ quantite: '1', prixUnitaire: '999.99', tva: '0' })], 30);
    expect(totaux.montantAcompte).toBe(300); // 299.997 → 300.00
    expect(totaux.resteAPayer).toBe(699.99);
    expect(totaux.montantAcompte + totaux.resteAPayer).toBe(999.99);
  });

  it('0 ligne → tous les montants à 0', () => {
    const totaux = calculerTotaux([], 30);
    expect(totaux).toEqual({ montantHT: 0, montantTVA: 0, montantTTC: 0, montantAcompte: 0, resteAPayer: 0 });
  });

  it('caractérisation : contrairement à mapLignesForApi, ne filtre PAS les lignes sans description', () => {
    const totaux = calculerTotaux([ligne({ description: '', quantite: '1', prixUnitaire: '100', tva: '0' })], 0);
    expect(totaux.montantTTC).toBe(100);
  });
});
