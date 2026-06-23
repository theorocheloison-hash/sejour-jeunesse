'use client';

import { useState } from 'react';
import type { ProduitCatalogue } from '@/src/lib/centre';

const round2 = (n: number) => Math.round(n * 100) / 100;

interface CatalogueSuggestionInputProps {
  /** Valeur courante (description de la ligne) affichée hors saisie. */
  value: string;
  /** Mise à jour de la description au fil de la frappe. */
  onChange: (value: string) => void;
  /** Catalogue produits du centre (peut être vide — l'autocomplete ne s'affiche alors pas). */
  catalogue: ProduitCatalogue[];
  /** Appelé quand l'utilisateur choisit un produit dans le dropdown. */
  onSelect: (produit: ProduitCatalogue) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Champ description avec autocomplete catalogue. Pattern partagé entre le devis
 * principal (création/modification) et le devis complémentaire — zéro duplication.
 * Gère son propre état de recherche/ouverture ; le filtre se déclenche à partir de
 * 2 caractères saisis et n'affiche rien si le catalogue est vide.
 */
export default function CatalogueSuggestionInput({
  value,
  onChange,
  catalogue,
  onSelect,
  placeholder = 'Description',
  className,
}: CatalogueSuggestionInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const results = open && search.length >= 2
    ? catalogue.filter((p) => p.nom.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="relative">
      <input
        value={open ? search : value}
        onChange={(e) => {
          setOpen(true);
          setSearch(e.target.value);
          onChange(e.target.value);
        }}
        onFocus={() => {
          setOpen(true);
          setSearch(value);
        }}
        onBlur={() => setTimeout(() => {
          setOpen(false);
          setSearch('');
        }, 150)}
        placeholder={placeholder}
        className={className}
      />
      {results.length > 0 && (
        <div className="absolute left-0 top-8 z-50 w-96 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(p);
                setOpen(false);
                setSearch('');
              }}
              className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
            >
              <span className="text-sm text-gray-900 line-clamp-2">{p.nom}</span>
              <span className="text-xs text-gray-500 shrink-0 ml-2">{((p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100)))).toFixed(2)} € TTC</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
