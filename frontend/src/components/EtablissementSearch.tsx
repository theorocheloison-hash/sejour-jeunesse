'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { rechercherEtablissements, type Etablissement } from '@/src/lib/etablissements';

interface Props {
  onSelect: (etab: Etablissement) => void;
  initialValue?: string;
}

export default function EtablissementSearch({ onSelect, initialValue }: Props) {
  const [query, setQuery] = useState(initialValue ?? '');
  const [results, setResults] = useState<Etablissement[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setIsOpen(false); return; }
    setLoading(true);
    try {
      // Detect if query is a postal code (5 digits)
      const isCP = /^\d{5}$/.test(q.trim());
      const data = isCP
        ? await rechercherEtablissements(undefined, q.trim())
        : await rechercherEtablissements(q.trim());
      setResults(data);
      setIsOpen(data.length > 0);
      setActiveIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const handleSelect = (etab: Etablissement) => {
    setQuery(etab.nom);
    setIsOpen(false);
    setResults([]);
    onSelect(etab);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Rechercher par nom ou code postal..."
          className="w-full rounded-lg border border-gray-300 pl-10 pr-10 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#003189] block" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {results.map((etab, idx) => (
            <button
              key={etab.uai}
              type="button"
              onClick={() => handleSelect(etab)}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${
                idx === activeIdx ? 'bg-[#003189]/5' : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{etab.nom}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {etab.adresse}, {etab.codePostal} {etab.commune}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {etab.nature || etab.type}
                  </span>
                  <span className="text-[10px] text-gray-400">{etab.academie}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
