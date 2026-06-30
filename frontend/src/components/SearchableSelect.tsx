'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

/** Normalise une chaîne pour une comparaison insensible aux accents et à la casse. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface SearchableSelectProps<T> {
  /** Liste complète des items parmi lesquels chercher */
  items: T[];
  /** Fonction qui retourne la valeur unique (ex: sejourId) */
  valueFn: (item: T) => string;
  /** Fonction qui retourne le label d'affichage principal */
  labelFn: (item: T) => string;
  /** Optionnel : label secondaire affiché en gris sous le label principal (ex: dates) */
  subLabelFn?: (item: T) => string;
  /** Valeur actuellement sélectionnée (la value, pas le label) */
  value: string;
  /** Callback quand une valeur est sélectionnée */
  onChange: (value: string) => void;
  /** Placeholder quand rien n'est sélectionné */
  placeholder?: string;
  /** Valeurs à exclure du dropdown (pour dédoublonnage) */
  excludeValues?: string[];
  /** Classes CSS additionnelles sur le container */
  className?: string;
  /** Désactiver le composant */
  disabled?: boolean;
}

export default function SearchableSelect<T>({
  items,
  valueFn,
  labelFn,
  subLabelFn,
  value,
  onChange,
  placeholder = 'Rechercher…',
  excludeValues = [],
  className = '',
  disabled = false,
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(
    () => items.find((it) => valueFn(it) === value) ?? null,
    [items, value, valueFn],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    return items.filter((it) => {
      const val = valueFn(it);
      if (val === value) return false; // l'item courant n'a pas besoin d'être re-listé
      if (excludeValues.includes(val)) return false;
      if (!q) return true;
      const hay = normalize(labelFn(it) + ' ' + (subLabelFn ? subLabelFn(it) : ''));
      return hay.includes(q);
    });
  }, [items, query, value, excludeValues, valueFn, labelFn, subLabelFn]);

  // Fermeture au clic extérieur (mousedown + ref, pas de onBlur fragile)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Auto-focus de l'input de recherche à l'ouverture
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
    setActiveIdx(-1);
  };

  const handleSelect = (item: T) => {
    onChange(valueFn(item));
    setIsOpen(false);
    setQuery('');
    setActiveIdx(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0 && activeIdx < filtered.length) {
      e.preventDefault();
      handleSelect(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {isOpen ? (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={inputCls}
        />
      ) : (
        <div
          onClick={open}
          className={`${inputCls} flex items-center justify-between gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={`truncate ${selectedItem ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedItem ? labelFn(selectedItem) : placeholder}
          </span>
          {selectedItem && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-gray-400 hover:text-red-500"
              title="Effacer"
            >
              ×
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {items.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-400">Aucun élément disponible</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-gray-400">Aucun résultat</p>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={valueFn(item)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIdx(idx)}
                className={`px-3 py-2.5 cursor-pointer ${idx === activeIdx ? 'bg-[var(--color-primary-light)]' : 'hover:bg-[var(--color-primary-light)]'}`}
              >
                <p className="text-sm text-gray-900 truncate">{labelFn(item)}</p>
                {subLabelFn && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{subLabelFn(item)}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
