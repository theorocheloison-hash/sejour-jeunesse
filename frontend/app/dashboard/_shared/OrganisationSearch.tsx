'use client';
import { useEffect, useRef, useState } from 'react';
import { searchEtablissement } from '@/src/lib/clients';
import type { EtablissementEN } from '@/src/lib/clients';
import api from '@/src/lib/api';

// Résultat unifié des deux annuaires (Éducation Nationale + SIRENE).
export interface OrganisationResult {
  nom: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  uai: string | null;
  siren: string | null;
  siret: string | null;
  academie: string | null;
  typeClient: string; // COLLEGE, LYCEE, ECOLE, ASSOCIATION, ENTREPRISE, CE, AUTRE
  source: 'API_EN' | 'API_SIRENE';
}

interface OrganisationSearchProps {
  onSelect: (org: OrganisationResult) => void;
  placeholder?: string;
  className?: string;
}

// Résultat brut renvoyé par /organisations/search (annuaire SIRENE).
interface SireneRaw {
  siren: string | null;
  siret: string | null;
  nom: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  departement: string | null;
  typeStructure: string | null;
  source: string;
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function mapEnType(type: string): string {
  return type === 'Collège' ? 'COLLEGE'
    : type === 'Lycée' ? 'LYCEE'
    : type.startsWith('Ecole') ? 'ECOLE'
    : 'ETABLISSEMENT_SCOLAIRE';
}

function mapSireneType(typeStructure: string | null): string {
  return typeStructure === 'COLLEGE_LYCEE' ? 'COLLEGE'
    : typeStructure === 'ECOLE_PRIMAIRE' ? 'ECOLE'
    : typeStructure === 'ASSOCIATION' ? 'ASSOCIATION'
    : typeStructure === 'COMITE_ENTREPRISE' ? 'CE'
    : typeStructure === 'ENTREPRISE' || typeStructure === 'MICRO_ENTREPRISE' ? 'AUTRE'
    : typeStructure === 'MAIRIE' || typeStructure === 'COLLECTIVITE_TERRITORIALE' ? 'AUTRE'
    : 'AUTRE';
}

function mapEn(etab: EtablissementEN): OrganisationResult {
  return {
    nom: etab.nom,
    adresse: etab.adresse,
    codePostal: etab.codePostal,
    ville: etab.ville,
    email: etab.email,
    telephone: etab.telephone,
    uai: etab.uai,
    siren: null,
    siret: null,
    academie: etab.academie,
    typeClient: mapEnType(etab.type),
    source: 'API_EN',
  };
}

function mapSirene(r: SireneRaw): OrganisationResult {
  return {
    nom: r.nom,
    adresse: r.adresse,
    codePostal: r.codePostal,
    ville: r.ville,
    email: null,
    telephone: null,
    uai: null,
    siren: r.siren,
    siret: r.siret,
    academie: null,
    typeClient: mapSireneType(r.typeStructure),
    source: 'API_SIRENE',
  };
}

export default function OrganisationSearch({ onSelect, placeholder, className }: OrganisationSearchProps) {
  const [query, setQuery] = useState('');
  const [enResults, setEnResults] = useState<OrganisationResult[]>([]);
  const [sireneResults, setSireneResults] = useState<OrganisationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermeture du dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    setIsOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = value.trim();
    if (q.length < 2) {
      setEnResults([]);
      setSireneResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const [enResult, sireneResult] = await Promise.allSettled([
        searchEtablissement(q),
        api.get('/organisations/search', { params: { q }, signal: controller.signal }).then(r => r.data?.results ?? []),
      ]);

      if (controller.signal.aborted) return;

      const enData: EtablissementEN[] = enResult.status === 'fulfilled' ? enResult.value : [];
      const sireneData: SireneRaw[] = sireneResult.status === 'fulfilled' ? sireneResult.value : [];

      const enMapped = enData.map(mapEn);
      const sireneMapped = sireneData.map(mapSirene);

      // Dedup : un résultat SIRENE doublon d'un établissement ÉN (même nom + ville) est masqué
      // au profit de l'ÉN (plus riche : UAI, email, téléphone, académie).
      const enKeys = new Set(enMapped.map(e => `${normalise(e.nom)}|${normalise(e.ville ?? '')}`));
      const sireneDeduped = sireneMapped.filter(s => !enKeys.has(`${normalise(s.nom)}|${normalise(s.ville ?? '')}`));

      setEnResults(enMapped);
      setSireneResults(sireneDeduped);
      setIsSearching(false);
    }, 350);
  };

  const handleSelect = (org: OrganisationResult) => {
    onSelect(org);
    setQuery('');
    setEnResults([]);
    setSireneResults([]);
    setIsOpen(false);
  };

  const hasResults = enResults.length > 0 || sireneResults.length > 0;

  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder ?? 'Rechercher une organisation...'}
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent inline-block" />
          </div>
        )}
      </div>

      {isOpen && query.trim().length >= 2 && (hasResults || !isSearching) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
          {enResults.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Établissements scolaires</p>
              {enResults.map((org, i) => (
                <button
                  key={`en-${org.uai ?? i}`}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{org.nom}</p>
                  <p className="text-xs text-gray-400">
                    {org.ville && <span className="mr-2">{org.ville}</span>}
                    <span>Éducation Nationale</span>
                  </p>
                </button>
              ))}
            </>
          )}
          {sireneResults.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Entreprises &amp; organisations</p>
              {sireneResults.map((org, i) => (
                <button
                  key={`sirene-${org.siret ?? i}`}
                  type="button"
                  onClick={() => handleSelect(org)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">{org.nom}</p>
                  <p className="text-xs text-gray-400">
                    {org.ville && <span className="mr-2">{org.ville}</span>}
                    <span>SIRENE</span>
                  </p>
                </button>
              ))}
            </>
          )}
          {!hasResults && !isSearching && (
            <p className="px-3 py-3 text-xs text-gray-400">Aucun résultat</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-1">
        La recherche interroge l&apos;annuaire Éducation Nationale et le répertoire SIRENE
      </p>
    </div>
  );
}
