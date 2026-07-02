'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ProduitCatalogue } from '@/src/lib/centre';
import type { LigneDevis } from '@/src/lib/devis';
import {
  calculerTotaux,
  mapLignesForApi,
  resolvePrixCatalogueTTC,
  type DevisCalculs,
} from '@/src/lib/devis-calculs';

/**
 * Ligne du formulaire de devis. Les valeurs sont des strings (inputs
 * contrôlés) ; le PU est exprimé TTC (le HT est dérivé à la soumission).
 * `key` est une clé React stable, indépendante de l'index.
 */
export type LigneForm = {
  key: string;
  description: string;
  quantite: string;
  prixUnitaire: string;
  tva: string;
  produitCatalogueId?: string;
};

let keyCounter = 0;
function newKey() { return `l-${++keyCounter}`; }

export function makeLigneForm(opts?: {
  description?: string;
  quantite?: string;
  prixUnitaire?: string;
  tva?: string;
  produitCatalogueId?: string;
}): LigneForm {
  return {
    key: newKey(),
    description: opts?.description ?? '',
    quantite: opts?.quantite ?? '',
    prixUnitaire: opts?.prixUnitaire ?? '',
    tva: opts?.tva ?? '0',
    produitCatalogueId: opts?.produitCatalogueId,
  };
}

/**
 * State + handlers + totaux des lignes d'un devis. Partagé entre le builder
 * de création (devis/nouveau) et l'éditeur (devis/[id]/modifier).
 */
export function useDevisLignes(initialLignes?: LigneForm[]) {
  const [lignes, setLignes] = useState<LigneForm[]>(initialLignes ?? [makeLigneForm()]);
  const [pourcentageAcompte, setPourcentageAcompte] = useState(30);

  const updateLigne = useCallback((key: string, field: keyof LigneForm, value: string) => {
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }, []);

  const addLigne = useCallback(() => {
    setLignes((prev) => [...prev, makeLigneForm()]);
  }, []);

  const removeLigne = useCallback((key: string) => {
    setLignes((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const insertLigneAt = useCallback((afterIndex: number) => {
    setLignes((prev) => [
      ...prev.slice(0, afterIndex + 1),
      makeLigneForm(),
      ...prev.slice(afterIndex + 1),
    ]);
  }, []);

  const selectProduitForLigne = useCallback((key: string, produit: ProduitCatalogue) => {
    setLignes((prev) => prev.map((l) =>
      l.key === key
        ? { ...l, description: produit.nom, prixUnitaire: String(resolvePrixCatalogueTTC(produit)), tva: String(produit.tva), produitCatalogueId: produit.id }
        : l
    ));
  }, []);

  const calculs: DevisCalculs = useMemo(
    () => calculerTotaux(lignes, pourcentageAcompte),
    [lignes, pourcentageAcompte],
  );

  /** Lignes au format API (PU HT dérivé, totaux arrondis, lignes vides exclues). */
  const lignesForApi = useCallback((): Omit<LigneDevis, 'id'>[] => mapLignesForApi(lignes), [lignes]);

  return {
    lignes,
    setLignes,
    pourcentageAcompte,
    setPourcentageAcompte,
    updateLigne,
    addLigne,
    removeLigne,
    insertLigneAt,
    selectProduitForLigne,
    calculs,
    lignesForApi,
  };
}

export type UseDevisLignes = ReturnType<typeof useDevisLignes>;
