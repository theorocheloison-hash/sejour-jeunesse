'use client';

import { useEffect, useId, useRef, useState } from 'react';
import api from '@/src/lib/api';

export interface OrganisationSearchResult {
  siren: string | null;
  siret: string | null;
  nom: string;
  raisonSociale: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  departement: string | null;
  typeStructure: string | null;
  source: string;
}

interface StructureSearchProps {
  onSelect: (result: OrganisationSearchResult | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  defaultSearchValue?: string;
  label?: string;
}

const sourceBadge = (source: string): string | null => {
  if (source === 'API_SIRENE') return 'SIRENE';
  if (source === 'API_EDUCATION_NATIONALE') return 'EN';
  if (source === 'APIDAE') return 'APIDAE';
  return null;
};

const buildFreeText = (nom: string): OrganisationSearchResult => ({
  nom,
  siren: null,
  siret: null,
  raisonSociale: null,
  adresse: null,
  codePostal: null,
  ville: null,
  departement: null,
  typeStructure: null,
  source: 'MANUAL',
});

export default function StructureSearch({
  onSelect,
  placeholder = 'Nom de la structure, ville…',
  disabled = false,
  allowFreeText = false,
  defaultSearchValue = '',
  label,
}: StructureSearchProps) {
  const listboxId = useId();
  const optionIdPrefix = useId();

  const [query, setQuery] = useState(defaultSearchValue);
  const [results, setResults] = useState<OrganisationSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const [selected, setSelected] = useState<OrganisationSearchResult | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const runSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await api.get('/organisations/search', {
          params: { q: q.trim() },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const data = res.data?.results ?? [];
        setResults(data);
        setHighlight(-1);
        setOpen(true);
      } catch {
        // aborted or network error : silent fallback
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (selected) {
      setSelected(null);
      onSelect(null);
    }
    runSearch(value);
  };

  const pick = (item: OrganisationSearchResult) => {
    setSelected(item);
    setQuery(item.nom);
    setResults([]);
    setOpen(false);
    setHighlight(-1);
    onSelect(item);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setHighlight(-1);
    onSelect(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      if (open && highlight >= 0 && results[highlight]) {
        e.preventDefault();
        pick(results[highlight]);
      } else if (allowFreeText && query.trim().length >= 2) {
        e.preventDefault();
        const ft = buildFreeText(query.trim());
        setSelected(ft);
        setOpen(false);
        onSelect(ft);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const showDropdown =
    open && !selected && query.trim().length >= 2 && (results.length > 0 || !loading);

  const inputClassName =
    'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50';

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            highlight >= 0 ? `${optionIdPrefix}-${highlight}` : undefined
          }
          className={inputClassName}
        />
        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}
      </div>

      {selected && (
        <button
          type="button"
          onClick={clear}
          className="mt-1 text-xs text-red-500 hover:underline"
        >
          Effacer
        </button>
      )}

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">Aucun résultat</p>
          ) : (
            results.map((r, idx) => {
              const badge = sourceBadge(r.source);
              const active = idx === highlight;
              return (
                <button
                  key={`${r.siren ?? r.siret ?? r.nom}-${idx}`}
                  id={`${optionIdPrefix}-${idx}`}
                  role="option"
                  aria-selected={active}
                  type="button"
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  className={`block w-full px-3 py-2 text-left transition ${
                    active ? 'bg-gray-100' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{r.nom}</p>
                      <p className="truncate text-xs text-gray-500">
                        {[r.ville, r.codePostal].filter(Boolean).join(' — ')}
                      </p>
                    </div>
                    {badge && (
                      <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        {badge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
