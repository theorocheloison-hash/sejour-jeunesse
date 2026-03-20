'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDevis, facturerAcompte, facturerSolde, getChorusXml } from '@/src/lib/devis';
import type { Devis, StatutDevis } from '@/src/lib/devis';

// ─── Statut badges ──────────────────────────────────────────────────────────

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',          cls: 'bg-orange-100 text-orange-700' },
  ACCEPTE:               { label: 'Accepté',             cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  REFUSE:                { label: 'Refusé',              cls: 'bg-red-100 text-red-700' },
  EN_ATTENTE_VALIDATION: { label: 'En validation',       cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',         cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  NON_RETENU:            { label: 'Non retenu',          cls: 'bg-gray-100 text-gray-600' },
};

type FiltreStatut = 'ALL' | 'EN_ATTENTE' | 'SELECTIONNE' | 'FACTURE_ACOMPTE' | 'NON_RETENU';

const FILTRE_OPTIONS: { value: FiltreStatut; label: string }[] = [
  { value: 'ALL',              label: 'Tous' },
  { value: 'EN_ATTENTE',      label: 'En attente' },
  { value: 'SELECTIONNE',     label: 'Sélectionné' },
  { value: 'FACTURE_ACOMPTE', label: 'Facture acompte' },
  { value: 'NON_RETENU',      label: 'Non retenu' },
];

// ─── Normalize for accent-insensitive search ────────────────────────────────

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Highlight matching text ────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);
  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Search logic ───────────────────────────────────────────────────────────

function matchesSearch(d: Devis, query: string): boolean {
  if (!query || query.length < 2) return true;
  const q = normalize(query);
  const fields = [
    d.demande?.sejour?.createur?.prenom,
    d.demande?.sejour?.createur?.nom,
    d.demande?.sejour?.createur?.etablissementNom,
    d.demande?.enseignant?.prenom,
    d.demande?.enseignant?.nom,
    d.demande?.enseignant?.etablissementNom,
    d.demande?.sejour?.titre,
    d.demande?.titre,
    d.numeroDevis,
    d.numeroFacture,
  ];
  return fields.some((f) => f && normalize(f).includes(q));
}

function matchesStatut(d: Devis, filtre: FiltreStatut): boolean {
  if (filtre === 'ALL') return true;
  if (filtre === 'FACTURE_ACOMPTE') return d.typeDocument === 'FACTURE_ACOMPTE';
  return d.statut === filtre;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function VenueDevisPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facturantId, setFacturantId] = useState<string | null>(null);
  const [chorusXml, setChorusXml] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('ALL');

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.push('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'VENUE') {
      getMesDevis()
        .then(setDevisList)
        .catch(() => setError('Impossible de charger les devis.'));
    }
  }, [user]);

  const filteredDevis = useMemo(() => {
    return devisList
      .filter((d) => matchesSearch(d, searchQuery))
      .filter((d) => matchesStatut(d, filtreStatut));
  }, [devisList, searchQuery, filtreStatut]);

  const handleFacturerAcompte = async (id: string) => {
    setFacturantId(id);
    try {
      const updated = await facturerAcompte(id);
      setDevisList((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
    } catch {
      setError('Erreur lors de la conversion en facture.');
    } finally {
      setFacturantId(null);
    }
  };

  const handleChorusXml = async (id: string) => {
    try {
      const { xml } = await getChorusXml(id);
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chorus-pro-${id.substring(0, 8)}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  };

  const handleFacturerSolde = async (devisId: string) => {
    try {
      const updated = await facturerSolde(devisId);
      setDevisList(prev => prev.map(d => d.id === devisId ? { ...d, ...updated } : d));
    } catch { /* ignore */ }
  };

  if (isLoading || !user) return null;

  const getEnseignantDisplay = (d: Devis): string => {
    const c = d.demande?.sejour?.createur;
    if (c) return `${c.prenom} ${c.nom}`;
    const e = d.demande?.enseignant;
    if (e) return `${e.prenom} ${e.nom}`;
    return '';
  };

  const getEtablissementDisplay = (d: Devis): string => {
    return d.demande?.sejour?.createur?.etablissementNom
      ?? d.demande?.enseignant?.etablissementNom
      ?? '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/venue" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Devis envoyés</h1>
        <p className="text-sm text-gray-500 mb-6">Suivez vos propositions et devis en cours</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Barre de recherche + filtre statut ── */}
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
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as FiltreStatut)}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#003189] focus:border-transparent bg-white"
          >
            {FILTRE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Compteur */}
        <p className="text-xs text-gray-500 mb-4">
          {filteredDevis.length} devis trouvé{filteredDevis.length > 1 ? 's' : ''}
          {searchQuery.length >= 2 && ` pour « ${searchQuery} »`}
        </p>

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
            {searchQuery.length >= 2 && (
              <button onClick={() => { setSearchQuery(''); setFiltreStatut('ALL'); }} className="mt-3 text-sm text-[var(--color-primary)] font-semibold hover:underline">
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDevis.map((d) => {
              const badge = STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE;
              const enseignant = getEnseignantDisplay(d);
              const etablissement = getEtablissementDisplay(d);
              const sejourTitre = d.demande?.sejour?.titre ?? d.demande?.titre ?? 'Demande';
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          <Highlight text={sejourTitre} query={searchQuery} />
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {d.typeDocument === 'FACTURE_ACOMPTE' && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Facture {d.numeroFacture && <Highlight text={d.numeroFacture} query={searchQuery} />}
                          </span>
                        )}
                        {d.numeroDevis && d.typeDocument !== 'FACTURE_ACOMPTE' && (
                          <span className="text-xs text-gray-400">
                            <Highlight text={d.numeroDevis} query={searchQuery} />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Total : {d.montantTotal} €</span>
                        <span>Par élève : {d.montantParEleve} €</span>
                        {enseignant && (
                          <span>
                            <Highlight text={enseignant} query={searchQuery} />
                          </span>
                        )}
                        {etablissement && (
                          <span>
                            <Highlight text={etablissement} query={searchQuery} />
                          </span>
                        )}
                        <span>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                    </div>
                    {(d.statut === 'EN_ATTENTE' || d.statut === 'SELECTIONNE') && (
                      <Link
                        href={`/dashboard/venue/devis/${d.id}/modifier`}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                        </svg>
                        Modifier
                      </Link>
                    )}
                    {d.statut === 'SELECTIONNE' && (
                      <div className="shrink-0 flex flex-col gap-2 items-end">
                        {d.demande?.enseignant && (
                          <div className="rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success-light)] px-4 py-3">
                            <p className="text-xs font-semibold text-[var(--color-success)] mb-1">
                              {d.demande.enseignant.prenom} {d.demande.enseignant.nom}
                            </p>
                            <div className="flex flex-col gap-0.5 text-xs text-[var(--color-success)]">
                              {d.demande.enseignant.email && (
                                <a href={`mailto:${d.demande.enseignant.email}`} className="hover:underline">
                                  {d.demande.enseignant.email}
                                </a>
                              )}
                              {d.demande.enseignant.telephone && (
                                <a href={`tel:${d.demande.enseignant.telephone}`} className="hover:underline">
                                  {d.demande.enseignant.telephone}
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        {d.typeDocument === 'FACTURE_ACOMPTE' ? (
                          <div className="rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success-light)] px-4 py-2 text-xs text-[var(--color-success)] font-semibold">
                            Facture acompte envoyée — {d.numeroFacture} — {Number(d.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </div>
                        ) : (!d.typeDocument || d.typeDocument === 'DEVIS') && (
                          <button
                            onClick={() => handleFacturerAcompte(d.id)}
                            disabled={facturantId === d.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                          >
                            {facturantId === d.id ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : null}
                            Convertir en facture d&apos;acompte
                          </button>
                        )}

                        {/* Facture solde */}
                        {d.statut === 'SELECTIONNE' && d.typeDocument === 'FACTURE_ACOMPTE' && d.acompteVerse && (
                          <button
                            onClick={() => handleFacturerSolde(d.id)}
                            className="mt-2 w-full rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                          >
                            Générer la facture de solde
                          </button>
                        )}

                        {d.typeDocument === 'FACTURE_SOLDE' && (
                          <div className="mt-2 flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2">
                            <span className="text-xs font-semibold text-purple-700">Facture solde émise</span>
                            <span className="text-xs text-purple-500">{d.numeroFacture}</span>
                          </div>
                        )}

                        {/* Boutons Chorus Pro */}
                        {(d.typeDocument === 'FACTURE_ACOMPTE' || d.typeDocument === 'FACTURE_SOLDE') && (
                          <button
                            onClick={() => handleChorusXml(d.id)}
                            className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Télécharger XML Chorus Pro
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
