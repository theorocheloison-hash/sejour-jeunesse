import type { ProduitCatalogue } from '@/src/lib/centre';
import type { LigneDevis } from '@/src/lib/devis';

/**
 * Utilitaires de calcul partagés entre les builders de devis
 * (nouveau, modifier, TabDevisFacturation).
 *
 * Convention métier (RÈGLE 4) : l'utilisateur saisit des prix TTC ;
 * le HT est dérivé et c'est le PU HT qui est stocké en base.
 */

/** Arrondi monétaire à 2 décimales. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Prix TTC d'un produit catalogue : prixUnitaireTTC s'il est renseigné,
 * sinon dérivé du HT + TVA.
 */
export function resolvePrixCatalogueTTC(produit: ProduitCatalogue): number {
  return produit.prixUnitaireTTC ?? round2(produit.prixUnitaireHT * (1 + produit.tva / 100));
}

/** Montant affiché en français : séparateur de milliers + 2 décimales. */
export function formatMontant(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Ligne de formulaire (saisie utilisateur, valeurs en string, PU exprimé TTC). */
export interface LigneFormInput {
  description: string;
  quantite: string;
  prixUnitaire: string; // PU TTC saisi
  tva: string;
  produitCatalogueId?: string;
}

/**
 * Mappe les lignes du formulaire vers le format API : PU TTC saisi → PU HT
 * dérivé (stocké en base), totaux arrondis ligne par ligne. Les lignes sans
 * description sont ignorées.
 */
export function mapLignesForApi(lignes: LigneFormInput[]): Omit<LigneDevis, 'id'>[] {
  return lignes
    .filter((l) => l.description.trim().length > 0)
    .map((l) => {
      const qte = parseFloat(l.quantite) || 0;
      const puTTC = parseFloat(l.prixUnitaire) || 0;
      const tvaL = parseFloat(l.tva) || 0;
      const puHT = round2(puTTC / (1 + tvaL / 100));
      const totalTTC = round2(puTTC * qte);
      const totalHT = round2(puHT * qte);
      return { description: l.description, quantite: qte, prixUnitaire: puHT, tva: tvaL, totalHT, totalTTC, produitCatalogueId: l.produitCatalogueId };
    });
}

/** Totaux agrégés d'un devis (tous montants arrondis à 2 décimales). */
export interface DevisCalculs {
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  montantAcompte: number;
  resteAPayer: number;
}

/**
 * Calcule les totaux HT/TVA/TTC + acompte à partir des lignes du formulaire.
 * Chaque ligne est arrondie individuellement, puis les sommes accumulées sont
 * ré-arrondies : une somme de valeurs déjà arrondies peut produire un artéfact
 * float (ex: 4112.50 + 8200.30 = 12312.800000000001).
 */
export function calculerTotaux(lignes: LigneFormInput[], pourcentageAcompte: number): DevisCalculs {
  let montantHT = 0;
  let montantTTC = 0;
  lignes.forEach((l) => {
    const qte = parseFloat(l.quantite) || 0;
    const puTTC = parseFloat(l.prixUnitaire) || 0;
    const tvaLigne = parseFloat(l.tva) || 0;
    const puHT = round2(puTTC / (1 + tvaLigne / 100));
    montantHT += round2(puHT * qte);
    montantTTC += round2(puTTC * qte);
  });
  montantHT = round2(montantHT);
  montantTTC = round2(montantTTC);
  const montantTVA = round2(montantTTC - montantHT);
  const montantAcompte = round2(montantTTC * (pourcentageAcompte / 100));
  const resteAPayer = round2(montantTTC - montantAcompte);
  return { montantHT, montantTVA, montantTTC, montantAcompte, resteAPayer };
}
