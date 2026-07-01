'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDevis, getFactureAcompte, getFactureSolde } from '@/src/lib/devis';
import type { Devis } from '@/src/lib/devis';
import {
  computeAlertes,
  estAlerte,
  resolveSejourDateDebut,
  resolveSejourDateFin,
} from '@/src/lib/devisAlertes';
import type { CategorieAlerte } from '@/src/lib/devisAlertes';
import DevisCard, { normalize } from './_components/DevisCard';

// ─── Onglets ──────────────────────────────────────────────────────────────────

type OngletDevis = 'attente' | 'a-facturer' | 'suivi-acomptes' | 'suivi-soldes' | 'historique';

const VALID_TABS: OngletDevis[] = ['attente', 'a-facturer', 'suivi-acomptes', 'suivi-soldes', 'historique'];

const ONGLETS: { key: OngletDevis; label: string; tooltip: string }[] = [
  { key: 'attente',        label: 'En attente de réponse', tooltip: 'Devis envoyés en attente de réponse du client' },
  { key: 'a-facturer',     label: 'À facturer',            tooltip: 'Soldes à créer (séjour passé) et acomptes à créer (devis signés)' },
  { key: 'suivi-acomptes', label: 'Suivi acomptes',        tooltip: 'Factures d\'acompte émises' },
  { key: 'suivi-soldes',   label: 'Suivi soldes',          tooltip: 'Factures de solde émises non intégralement payées' },
  { key: 'historique',     label: 'Historique',            tooltip: 'Devis soldés, annulés ou non retenus' },
];

const MONETARY_ONGLETS = new Set<OngletDevis>(['a-facturer', 'suivi-acomptes', 'suivi-soldes']);

// ─── Logique onglets ──────────────────────────────────────────────────────────

function matchesOnglet(d: Devis, onglet: OngletDevis): boolean {
  const fa = getFactureAcompte(d);
  const fs = getFactureSolde(d);
  const fsSoldee = !!fs && (fs.montantVerseTotal ?? 0) >= fs.montantFacture * 0.99;
  switch (onglet) {
    case 'attente':
      return (d.statut === 'EN_ATTENTE' || d.statut === 'EN_ATTENTE_VALIDATION') && !fa && !fs;
    case 'a-facturer':
      return (
        ((d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') && !fa && !fs)
        || (!!fa && !fs && new Date(resolveSejourDateFin(d)) < new Date())
      );
    case 'suivi-acomptes':
      return !!fa && !fs;
    case 'suivi-soldes':
      return !!fs && !fsSoldee;
    case 'historique':
      return fsSoldee || d.statut === 'NON_RETENU';
  }
}

// Sous-groupes de l'onglet « À facturer ».
function isSoldeACreer(d: Devis): boolean {
  return !!getFactureAcompte(d) && !getFactureSolde(d) && new Date(resolveSejourDateFin(d)) < new Date();
}
function isAcompteACreer(d: Devis): boolean {
  return (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION')
    && !getFactureAcompte(d) && !getFactureSolde(d);
}

/** Catégorie d'alerte du devis dans l'onglet courant (null si pas en alerte). */
function categorieForOnglet(d: Devis, onglet: OngletDevis): CategorieAlerte | null {
  switch (onglet) {
    case 'attente':
      return estAlerte(d, 'devisARelancer') ? 'devisARelancer' : null;
    case 'a-facturer':
      return estAlerte(d, 'aFacturer') ? 'aFacturer' : null;
    case 'suivi-acomptes':
      if (estAlerte(d, 'acomptesARelancer')) return 'acomptesARelancer';
      if (estAlerte(d, 'acomptesAValider')) return 'acomptesAValider';
      return null;
    case 'suivi-soldes':
      return estAlerte(d, 'soldesARelancer') ? 'soldesARelancer' : null;
    case 'historique':
      return null;
  }
}

/** Nom du client pour le tri (créateur du séjour, sinon enseignant). */
function resolveClientNom(d: Devis): string {
  const c = d.demande?.sejour?.createur;
  if (c) return `${c.prenom} ${c.nom}`;
  const e = d.demande?.enseignant;
  if (e) return `${e.prenom} ${e.nom}`;
  return '';
}

// ─── Recherche ────────────────────────────────────────────────────────────────

function matchesSearch(d: Devis, query: string): boolean {
  if (!query || query.length < 2) return true;
  const q = normalize(query);
  const fields = [
    d.demande?.sejour?.createur?.prenom,
    d.demande?.sejour?.createur?.nom,
    d.demande?.sejour?.createur?.memberships?.[0]?.organisation.nom,
    d.demande?.enseignant?.prenom,
    d.demande?.enseignant?.nom,
    d.demande?.enseignant?.memberships?.[0]?.organisation.nom,
    d.demande?.sejour?.titre,
    d.demande?.titre,
    d.sejourDirect?.titre,
    d.sejourDirect?.clientNom,
    d.numeroDevis,
    d.numeroFacture,
  ];
  return fields.some((f) => f && normalize(f).includes(q));
}

// ─── Styles chips bandeau ─────────────────────────────────────────────────────

const CHIP_ROUGE = 'inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors';
const CHIP_ORANGE = 'inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HebergeurDevisPage() {
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const tabParam = searchParams.get('tab');
  const [onglet, setOnglet] = useState<OngletDevis>(
    tabParam && VALID_TABS.includes(tabParam as OngletDevis) ? (tabParam as OngletDevis) : 'attente',
  );
  // Tri : par défaut « alertes en tête puis ancienneté croissante ». Un tri custom prend le dessus.
  const [customSort, setCustomSort] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'montant' | 'client'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Synchronise l'onglet avec ?tab= (anciens tabs invalides → fallback 'attente').
  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam as OngletDevis)) setOnglet(tabParam as OngletDevis);
  }, [tabParam]);

  const loadDevis = useCallback(() => {
    if (user?.role === 'HEBERGEUR') {
      getMesDevis().then(setDevisList).catch(() => setError('Impossible de charger les devis.'));
    }
  }, [user]);

  useEffect(() => { loadDevis(); }, [loadDevis]);

  useEffect(() => {
    window.addEventListener('focus', loadDevis);
    return () => window.removeEventListener('focus', loadDevis);
  }, [loadDevis]);

  const isSearching = searchQuery.length >= 2;

  const alertes = useMemo(() => computeAlertes(devisList), [devisList]);

  const filteredDevis = useMemo(() => {
    const list = devisList
      .filter((d) => matchesSearch(d, searchQuery))
      .filter((d) => (isSearching ? true : matchesOnglet(d, onglet)));
    if (!customSort) {
      // Alertes en tête, puis le plus ancien (createdAt) en tête = le plus urgent.
      return [...list].sort((a, b) => {
        const aa = categorieForOnglet(a, onglet) ? 0 : 1;
        const bb = categorieForOnglet(b, onglet) ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'montant') {
        const ma = Number(a.montantTTC) || Number(a.montantTotal) || 0;
        const mb = Number(b.montantTTC) || Number(b.montantTotal) || 0;
        return (ma - mb) * dir;
      }
      if (sortBy === 'client') {
        return resolveClientNom(a).localeCompare(resolveClientNom(b), 'fr', { sensitivity: 'base' }) * dir;
      }
      return (
        new Date(resolveSejourDateDebut(a)).getTime() - new Date(resolveSejourDateDebut(b)).getTime()
      ) * dir;
    });
  }, [devisList, searchQuery, onglet, isSearching, customSort, sortBy, sortDir]);

  // Résumé par onglet : nombre (+ montant total TTC pour les onglets monétaires).
  const ongletSummaries = useMemo(() => {
    const summaries: Record<OngletDevis, { count: number; montant: number }> = {
      attente: { count: 0, montant: 0 },
      'a-facturer': { count: 0, montant: 0 },
      'suivi-acomptes': { count: 0, montant: 0 },
      'suivi-soldes': { count: 0, montant: 0 },
      historique: { count: 0, montant: 0 },
    };
    devisList.forEach((d) => {
      for (const key of VALID_TABS) {
        if (matchesOnglet(d, key)) {
          summaries[key].count++;
          if (MONETARY_ONGLETS.has(key)) {
            summaries[key].montant += Number(d.montantTTC) || Number(d.montantTotal) || 0;
          }
        }
      }
    });
    return summaries;
  }, [devisList]);

  const handleSort = (key: 'date' | 'montant' | 'client') => {
    setCustomSort(true);
    if (sortBy === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'client' ? 'asc' : 'desc');
    }
  };

  if (isLoading || !user) return null;

  const renderCard = (d: Devis) => (
    <DevisCard
      key={d.id}
      devis={d}
      searchQuery={searchQuery}
      categorieAlerte={categorieForOnglet(d, onglet)}
    />
  );

  const soldesACreer = filteredDevis.filter(isSoldeACreer);
  const acomptesACreer = filteredDevis.filter(isAcompteACreer);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/hebergeur" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      {/* ── Bandeau alertes (non-dismissible) ── */}
      {alertes.total > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 flex-wrap">
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-semibold text-amber-800 mr-3">
              {alertes.total} action{alertes.total > 1 ? 's' : ''} en attente
            </p>
            {/* Ordre urgence : soldes à relancer > acomptes à relancer > acomptes à valider > devis à relancer > à facturer */}
            {alertes.soldesARelancer.count > 0 && (
              <button onClick={() => { setOnglet('suivi-soldes'); setSearchQuery(''); }} className={CHIP_ROUGE}>
                🔴 {alertes.soldesARelancer.count} solde{alertes.soldesARelancer.count > 1 ? 's' : ''} à relancer
              </button>
            )}
            {alertes.acomptesARelancer.count > 0 && (
              <button onClick={() => { setOnglet('suivi-acomptes'); setSearchQuery(''); }} className={CHIP_ROUGE}>
                🔴 {alertes.acomptesARelancer.count} acompte{alertes.acomptesARelancer.count > 1 ? 's' : ''} à relancer
              </button>
            )}
            {alertes.acomptesAValider.count > 0 && (
              <button onClick={() => { setOnglet('suivi-acomptes'); setSearchQuery(''); }} className={CHIP_ORANGE}>
                🟠 {alertes.acomptesAValider.count} acompte{alertes.acomptesAValider.count > 1 ? 's' : ''} à valider
              </button>
            )}
            {alertes.devisARelancer.count > 0 && (
              <button onClick={() => { setOnglet('attente'); setSearchQuery(''); }} className={CHIP_ORANGE}>
                🟠 {alertes.devisARelancer.count} devis à relancer
              </button>
            )}
            {alertes.aFacturer.count > 0 && (
              <button onClick={() => { setOnglet('a-facturer'); setSearchQuery(''); }} className={CHIP_ORANGE}>
                🟠 {alertes.aFacturer.count} à facturer
              </button>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Devis &amp; Facturation</h1>
        <p className="text-sm text-gray-500 mb-6">Suivi des devis, acomptes, soldes et paiements — les actions se font dans le dossier séjour.</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Barre de recherche ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, prénom ou établissement scolaire..."
              className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent"
            />
          </div>
          {isSearching && (
            <p className="mt-1.5 text-xs text-[var(--color-primary)] font-medium">
              Recherche dans tous les documents —{' '}
              <button onClick={() => setSearchQuery('')} className="underline hover:no-underline">
                Effacer
              </button>
            </p>
          )}
        </div>

        {/* Onglets */}
        <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
          {ONGLETS.map((o) => (
            <button
              key={o.key}
              onClick={() => setOnglet(o.key)}
              title={o.tooltip}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                onglet === o.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {o.label}
              {ongletSummaries[o.key].count > 0 && (
                <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                  onglet === o.key ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {MONETARY_ONGLETS.has(o.key)
                    ? `${ongletSummaries[o.key].count} · ${ongletSummaries[o.key].montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`
                    : ongletSummaries[o.key].count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Barre de tri ── */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-xs text-gray-400">Trier par</span>
          {([['date', 'Date'], ['montant', 'Montant'], ['client', 'Client']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={customSort && sortBy === key
                ? 'text-xs font-semibold text-[var(--color-primary)] underline'
                : 'text-xs font-medium text-gray-500 hover:text-gray-900'}
            >
              {label} {customSort && sortBy === key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
            </button>
          ))}
          {customSort && (
            <button
              onClick={() => setCustomSort(false)}
              className="text-xs font-medium text-gray-400 hover:text-gray-700"
            >
              Réinitialiser (alertes en tête)
            </button>
          )}
        </div>

        {/* ── Liste ── */}
        {filteredDevis.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 mb-4">
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">
              {devisList.length === 0 ? 'Aucun devis envoyé pour le moment.' : 'Aucun devis ne correspond à votre recherche'}
            </p>
            {isSearching && (
              <button onClick={() => { setSearchQuery(''); setOnglet('attente'); }} className="mt-3 text-sm text-[var(--color-primary)] font-semibold hover:underline">
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : onglet === 'a-facturer' && !isSearching ? (
          <div className="space-y-8">
            {soldesACreer.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">
                  Soldes à créer ({soldesACreer.length})
                </h3>
                <div className="space-y-4">{soldesACreer.map(renderCard)}</div>
              </div>
            )}
            {acomptesACreer.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-6 mb-3">
                  Acomptes à créer ({acomptesACreer.length})
                </h3>
                <div className="space-y-4">{acomptesACreer.map(renderCard)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDevis.map(renderCard)}
          </div>
        )}
      </main>
    </div>
  );
}
