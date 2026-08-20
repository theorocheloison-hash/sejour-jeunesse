'use client';
import { useEffect, useRef, useState } from 'react';
import type { OrganisationResult, SireneRaw } from '@/src/components/OrganisationSearch';
import type { EtablissementEN } from '@/src/lib/clients';
import { searchEtablissement } from '@/src/lib/clients';
import { searchOrganisationSirene } from '@/src/lib/organisations';

// Mappings type identiques à OrganisationSearch (source de vérité dupliquée volontairement
// pour ne pas modifier ce composant partagé). Voir OrganisationSearch.mapEnType / mapSireneType.
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

type Nature = 'SCOLAIRE' | 'AUTRE' | null;

interface RechercheOrganisationProps {
  onSelect: (org: OrganisationResult) => void;
  className?: string;
}

export default function RechercheOrganisation({ onSelect, className }: RechercheOrganisationProps) {
  const [nature, setNature] = useState<Nature>(null);
  const [nom, setNom] = useState('');
  const [cp, setCp] = useState('');
  const [results, setResults] = useState<OrganisationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Le gate strict : aucune requête tant que les 3 conditions ne sont pas réunies.
  const gateMet = nature !== null && nom.trim().length >= 2 && /^\d{5}$/.test(cp.trim());

  // Fermeture du dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
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

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!gateMet) {
      setResults([]);
      setLoading(false);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    setLoading(true);
    setOpen(true);
    const q = nom.trim();
    const codePostal = cp.trim();
    const currentNature = nature;

    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const mapped = currentNature === 'SCOLAIRE'
          ? (await searchEtablissement(q, codePostal)).map(mapEn)
          : (await searchOrganisationSirene(q, codePostal)).map(mapSirene);
        if (controller.signal.aborted) return;
        setResults(mapped);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nature, nom, cp]);

  const chooseNature = (n: Nature) => {
    setNature(n);
    setResults([]);
    setOpen(false);
  };

  const handleSelect = (org: OrganisationResult) => {
    onSelect(org);
    // Reset des champs de recherche mais on garde la nature choisie.
    setNom('');
    setCp('');
    setResults([]);
    setOpen(false);
  };

  const natureBtn = (active: boolean) =>
    `flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${active ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`;

  return (
    <div className={`relative ${className ?? ''}`} ref={containerRef}>
      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => chooseNature('SCOLAIRE')} className={natureBtn(nature === 'SCOLAIRE')}>
          🏫 Établissement scolaire
        </button>
        <button type="button" onClick={() => chooseNature('AUTRE')} className={natureBtn(nature === 'AUTRE')}>
          🏢 Autre organisation
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          value={nom}
          onChange={e => { setNom(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Nom"
          autoComplete="off"
          disabled={nature === null}
          className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
        />
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={cp}
          onChange={e => { setCp(e.target.value.replace(/\D/g, '')); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Code postal"
          autoComplete="off"
          disabled={nature === null}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
        />
      </div>

      {/* Feedback permanent : jamais de vide muet. */}
      {nature === null && (
        <p className="text-xs text-gray-400 mt-1">Choisissez d'abord le type d'organisation.</p>
      )}
      {nature !== null && !gateMet && (
        <p className="text-xs text-gray-400 mt-1">Saisissez le nom et le code postal (5 chiffres).</p>
      )}
      {gateMet && loading && (
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent inline-block" />
          Recherche en cours…
        </p>
      )}
      {gateMet && !loading && results.length === 0 && (
        <p className="text-xs text-gray-400 mt-1">Aucun résultat — vérifiez le code postal, ou saisissez le nom à la main ci-dessous.</p>
      )}

      {open && gateMet && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg max-h-72 overflow-y-auto">
          {results.map((org, i) => (
            <button
              key={`${org.source}-${org.uai ?? org.siret ?? i}`}
              type="button"
              onClick={() => handleSelect(org)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0 transition-colors"
            >
              <p className="text-sm font-medium text-gray-900 truncate">{org.nom}</p>
              <p className="text-xs text-gray-400">
                {org.ville && <span className="mr-2">{org.ville}</span>}
                <span>{org.source === 'API_EN' ? 'Éducation Nationale' : 'SIRENE'}</span>
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
