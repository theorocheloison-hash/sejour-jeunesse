'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesDevis, emettreFactureAcompte, getFactureAcompte, getFactureSolde, annulerDevis } from '@/src/lib/devis';
import type { Devis, StatutDevis } from '@/src/lib/devis';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

// ─── Statut badges ──────────────────────────────────────────────────────────

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',          cls: 'bg-orange-100 text-orange-700' },
  EN_ATTENTE_VALIDATION: { label: 'En validation',       cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',         cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  SIGNE_DIRECTION:       { label: 'Signé direction',     cls: 'bg-purple-100 text-purple-700' },
  NON_RETENU:            { label: 'Non retenu',          cls: 'bg-gray-100 text-gray-600' },
  FACTURE_ACOMPTE:       { label: 'Facture acompte',     cls: 'bg-indigo-100 text-indigo-700' },
  FACTURE_SOLDE:         { label: 'Facture solde',       cls: 'bg-teal-100 text-teal-700' },
};

type OngletDevis = 'attente' | 'selectionnes' | 'signes' | 'a-facturer' | 'acompte' | 'solde' | 'impayes';

const ONGLETS: { key: OngletDevis; label: string }[] = [
  { key: 'attente',      label: 'En attente' },
  { key: 'selectionnes', label: 'Sélectionnés' },
  { key: 'signes',       label: 'Signé direction' },
  { key: 'a-facturer',   label: 'À facturer' },
  { key: 'acompte',      label: 'Facture acompte' },
  { key: 'solde',        label: 'Facture solde' },
  { key: 'impayes',      label: 'Impayés' },
];

/** Date de début du séjour (collab → demande.sejour, direct → sejourDirect, fallback createdAt). */
function resolveSejourDateDebut(d: Devis): string {
  return d.demande?.sejour?.dateDebut ?? d.sejourDirect?.dateDebut ?? d.createdAt;
}

/** Somme des restes dus sur les factures émises (hors avoir) d'un devis. */
function resteImpaye(d: Devis): number {
  return (d.factures ?? []).reduce((sum, f) => {
    if (f.typeFacture === 'AVOIR') return sum;
    // Un acompte validé n'est jamais un impayé (micro-écart d'arrondi/frais ignoré).
    if (f.typeFacture === 'ACOMPTE' && f.acompteVerse) return sum;
    const reste = f.montantFacture - (f.montantVerseTotal ?? 0);
    return sum + (reste > 0 ? reste : 0);
  }, 0);
}

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
    d.demande?.sejour?.createur?.memberships?.[0]?.organisation.nom,
    d.demande?.enseignant?.prenom,
    d.demande?.enseignant?.nom,
    d.demande?.enseignant?.memberships?.[0]?.organisation.nom,
    d.demande?.sejour?.titre,
    d.demande?.titre,
    d.numeroDevis,
    d.numeroFacture,
  ];
  return fields.some((f) => f && normalize(f).includes(q));
}

// Lot 1 : la facturation se lit sur les Factures liées (le devis ne mute plus son statut).
function matchesOnglet(d: Devis, onglet: OngletDevis): boolean {
  const hasAcompte = !!getFactureAcompte(d);
  const hasSolde = !!getFactureSolde(d);
  switch (onglet) {
    case 'attente':
      return d.statut === 'EN_ATTENTE';
    case 'selectionnes':
      // Sélectionné, pas encore signé direction, pas encore facturé
      return d.statut === 'SELECTIONNE' && !d.signatureDirecteur && !hasAcompte && !hasSolde;
    case 'signes':
      // Signé direction (ou signature présente) mais pas encore facturé
      return (d.statut === 'SIGNE_DIRECTION' || !!d.signatureDirecteur) && !hasAcompte && !hasSolde;
    case 'a-facturer':
      // Aligné sur le KPI dashboard : acompte à émettre, OU solde à émettre (séjour passé).
      return d.isComplementaire !== true && (
        ((d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') && !hasAcompte && !hasSolde) ||
        (hasAcompte && !hasSolde && new Date(resolveSejourDateDebut(d)) < new Date())
      );
    case 'acompte':
      return hasAcompte && !hasSolde;
    case 'solde':
      return hasSolde;
    case 'impayes':
      // Au moins une facture émise (hors avoir) non intégralement réglée.
      return resteImpaye(d) > 0;
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

const VALID_TABS: OngletDevis[] = ['attente', 'selectionnes', 'signes', 'a-facturer', 'acompte', 'solde', 'impayes'];

export default function HebergeurDevisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [facturantId, setFacturantId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // Annulation de devis (modale double-confirmation)
  const [modalAnnulerId, setModalAnnulerId] = useState<string | null>(null);
  const [annulerLoading, setAnnulerLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const tabParam = searchParams.get('tab');
  const [onglet, setOnglet] = useState<OngletDevis>(
    tabParam && VALID_TABS.includes(tabParam as OngletDevis) ? (tabParam as OngletDevis) : 'attente',
  );

  // Synchronise l'onglet sélectionné avec le param URL (?tab=) au changement de lien.
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

  const handleConfirmerAnnulation = async () => {
    if (!modalAnnulerId) return;
    setAnnulerLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await annulerDevis(modalAnnulerId);
      setModalAnnulerId(null);
      setSuccessMsg('Devis annulé.');
      loadDevis();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de l\'annulation du devis.';
      setError(msg);
      setModalAnnulerId(null);
    } finally {
      setAnnulerLoading(false);
    }
  };

  const isSearching = searchQuery.length >= 2;

  const filteredDevis = useMemo(() => {
    const list = devisList
      .filter((d) => matchesSearch(d, searchQuery))
      .filter((d) => isSearching ? true : matchesOnglet(d, onglet));
    // Onglet Impayés : les plus gros restes dus en premier.
    if (!isSearching && onglet === 'impayes') {
      return [...list].sort((a, b) => resteImpaye(b) - resteImpaye(a));
    }
    return list;
  }, [devisList, searchQuery, onglet, isSearching]);

  const actionsUrgentes = useMemo(() => {
    const aFacturer = devisList.filter(d =>
      d.statut === 'SIGNE_DIRECTION' && !getFactureAcompte(d) && !getFactureSolde(d)
    );
    const aValider = devisList.filter(d => {
      const fa = getFactureAcompte(d);
      return !!fa && !fa.acompteVerse;
    });
    return { aFacturer, aValider, total: aFacturer.length + aValider.length };
  }, [devisList]);

  const ongletCounts = useMemo(() => {
    const counts: Record<OngletDevis, number> = { attente: 0, selectionnes: 0, signes: 0, 'a-facturer': 0, acompte: 0, solde: 0, impayes: 0 };
    devisList.forEach((d) => {
      for (const key of ONGLETS.map(o => o.key)) {
        if (matchesOnglet(d, key)) counts[key]++;
      }
    });
    return counts;
  }, [devisList]);

  const handleFacturerAcompte = async (id: string) => {
    setFacturantId(id);
    try {
      // Lot 1 : émet une Facture immuable (le devis n'est pas muté) → on recharge la liste.
      await emettreFactureAcompte(id);
      loadDevis();
    } catch {
      setError('Erreur lors de l\'émission de la facture d\'acompte.');
    } finally {
      setFacturantId(null);
    }
  };

  if (isLoading || !user) return null;

  const buildPdfProps = (d: Devis): DevisPDFProps => {
    const ens = d.demande?.enseignant;
    const sejour = d.demande?.sejour;
    const htCalc = Number(d.montantHT) || (d.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
    const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
    const tvaCalc = Number(d.montantTVA) || (d.lignes ?? []).reduce((sum, l) => sum + (Number(l.totalHT) * (Number(l.tva) / 100)), 0) || (ttcCalc - htCalc);
    return {
      typeDocument: d.typeDocument === 'FACTURE_ACOMPTE' ? 'FACTURE_ACOMPTE' : d.typeDocument === 'FACTURE_SOLDE' ? 'FACTURE_SOLDE' : 'DEVIS',
      numeroDocument: d.numeroDevis ?? d.numeroFacture ?? `DEV-${d.id.substring(0, 8).toUpperCase()}`,
      dateDocument: d.createdAt,
      nomEmetteur: d.nomEntreprise ?? d.centre?.nom ?? '',
      adresseEmetteur: d.adresseEntreprise ?? [d.centre?.adresse, d.centre?.codePostal, d.centre?.ville].filter(Boolean).join(', '),
      siretEmetteur: d.siretEntreprise ?? d.centre?.siret ?? undefined,
      emailEmetteur: d.emailEntreprise ?? d.centre?.email ?? undefined,
      telEmetteur: d.telEntreprise ?? d.centre?.telephone ?? undefined,
      tvaEmetteur: d.centre?.tvaIntracommunautaire ?? undefined,
      ibanEmetteur: d.centre?.iban ?? undefined,
      nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
      etablissementNom: ens?.memberships?.[0]?.organisation.nom ?? undefined,
      adresseDestinataire: ens?.memberships?.[0]?.organisation.ville ?? undefined,
      emailDestinataire: ens?.email ?? undefined,
      telDestinataire: ens?.telephone ?? undefined,
      titreSejour: sejour?.titre ?? d.demande?.titre ?? '',
      lieuSejour: d.demande?.villeHebergement,
      dateDebutSejour: sejour?.dateDebut ?? undefined,
      dateFinSejour: sejour?.dateFin ?? undefined,
      nombreEleves: d.demande?.nombreEleves,
      niveauClasse: sejour?.niveauClasse ?? undefined,
      lignes: (d.lignes ?? []).map(l => ({
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva,
        totalHT: l.totalHT,
        totalTTC: l.totalTTC,
      })),
      montantHT: htCalc,
      montantTVA: tvaCalc,
      montantTTC: ttcCalc,
      montantAcompte: d.montantAcompte != null ? Number(d.montantAcompte) : undefined,
      montantSolde: d.montantSolde != null ? Number(d.montantSolde) : undefined,
      pourcentageAcompte: d.pourcentageAcompte ?? undefined,
      conditionsAnnulation: d.conditionsAnnulation ?? d.centre?.conditionsAnnulation ?? undefined,
      dateValidite: d.dateFacture
        ? new Date(new Date(d.dateFacture).getTime() + 30 * 86400000).toISOString()
        : new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString(),
      signatureDirecteur: d.signatureDirecteur ?? undefined,
      logoUrl: d.centre?.logoUrl ?? null,
    };
  };

  const getEnseignantDisplay = (d: Devis): string => {
    const c = d.demande?.sejour?.createur;
    if (c) return `${c.prenom} ${c.nom}`;
    const e = d.demande?.enseignant;
    if (e) return `${e.prenom} ${e.nom}`;
    return '';
  };

  const getEtablissementDisplay = (d: Devis): string => {
    return d.demande?.sejour?.createur?.memberships?.[0]?.organisation?.nom
      ?? d.demande?.enseignant?.memberships?.[0]?.organisation?.nom
      ?? '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-3">
            <Link href="/dashboard/hebergeur" className="text-sm text-gray-500 hover:text-gray-900">&larr; Tableau de bord</Link>
          </div>
        </div>
      </nav>

      {!dismissed && actionsUrgentes.total > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-sm font-semibold text-amber-800">
                  {actionsUrgentes.total} action{actionsUrgentes.total > 1 ? 's' : ''} en attente
                </p>
              </div>
              <button
                onClick={() => setDismissed(true)}
                className="text-amber-500 hover:text-amber-700 transition-colors"
                title="Masquer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionsUrgentes.aFacturer.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setOnglet('signes'); setSearchQuery(''); setDismissed(true); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {d.demande?.sejour?.titre ?? d.demande?.titre ?? 'Devis'} — convertir en facture acompte
                </button>
              ))}
              {actionsUrgentes.aValider.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setOnglet('acompte'); setSearchQuery(''); setDismissed(true); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {d.demande?.sejour?.titre ?? d.demande?.titre ?? 'Facture'} — acompte à valider
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Devis envoyés</h1>
        <p className="text-sm text-gray-500 mb-6">Suivez vos propositions et devis en cours</p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {successMsg && (
          <div className="mb-6 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/30 px-4 py-3 text-sm text-[var(--color-success)] flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-[var(--color-success)] hover:opacity-70 shrink-0">×</button>
          </div>
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
        <div className="flex gap-0 border-b border-gray-200 mb-4">
          {ONGLETS.map((o) => (
            <button
              key={o.key}
              onClick={() => setOnglet(o.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                onglet === o.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {o.label}
              {ongletCounts[o.key] > 0 && (
                <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                  onglet === o.key ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {ongletCounts[o.key]}
                </span>
              )}
            </button>
          ))}
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
            {searchQuery.length >= 2 && (
              <button onClick={() => { setSearchQuery(''); setOnglet('attente'); }} className="mt-3 text-sm text-[var(--color-primary)] font-semibold hover:underline">
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDevis.map((d) => {
              const enseignant = getEnseignantDisplay(d);
              const etablissement = getEtablissementDisplay(d);
              // Lot 1 : factures liées (le devis ne mute plus son typeDocument).
              const fa = getFactureAcompte(d);
              const fs = getFactureSolde(d);
              // SC9 : le badge dérive des factures liées (le devis reste SELECTIONNE/SIGNE_DIRECTION).
              const badge = fs
                ? { label: 'Soldé', cls: 'bg-teal-100 text-teal-700' }
                : fa
                ? { label: 'Acompte facturé', cls: 'bg-indigo-100 text-indigo-700' }
                : (STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE);
              // Libellé : demande collaborative → titre séjour/demande ; sinon devis
              // DIRECT → titre du séjour direct ; séjour supprimé (soft-delete ou
              // orphelin) → "Séjour supprimé".
              const sejourDirectSupprime = !!d.sejourDirectId && (!d.sejourDirect || !!d.sejourDirect.deletedAt);
              const sejourTitre =
                d.demande?.sejour?.titre
                ?? d.demande?.titre
                ?? (sejourDirectSupprime
                  ? 'Séjour supprimé'
                  : d.sejourDirect?.titre ?? (d.sejourDirectId ? 'Séjour direct' : 'Devis'));
              // Pas de lien si le séjour direct n'existe plus.
              const sejourId = sejourDirectSupprime
                ? (d.demande?.sejour?.id ?? null)
                : (d.sejourDirectId ?? d.demande?.sejour?.id ?? null);
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">
                          {sejourId ? (
                            <Link href={`/dashboard/sejour/${sejourId}`} className="hover:text-[var(--color-primary)] hover:underline">
                              <Highlight text={sejourTitre} query={searchQuery} />
                            </Link>
                          ) : (
                            <Highlight text={sejourTitre} query={searchQuery} />
                          )}
                        </h3>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {sejourId && (
                          <Link
                            href={`/dashboard/sejour/${sejourId}`}
                            className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                          >
                            Ouvrir le dossier
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        )}
                        {fa && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            Facture <Highlight text={fa.numero} query={searchQuery} />
                          </span>
                        )}
                        {fs && (
                          <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                            Solde <Highlight text={fs.numero} query={searchQuery} />
                          </span>
                        )}
                        {d.numeroDevis && !fa && (
                          <span className="text-xs text-gray-400">
                            <Highlight text={d.numeroDevis} query={searchQuery} />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Total : {d.montantTotal} €</span>
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
                        {d.demande?.sejour?.dateDebut && d.demande?.sejour?.dateFin && (
                          <span className="font-medium text-gray-600">
                            {new Date(d.demande.sejour.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            {' → '}
                            {new Date(d.demande.sejour.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        <span className="text-gray-400">Devis du {new Date(d.createdAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      {d.description && <p className="mt-2 text-sm text-gray-600">{d.description}</p>}
                      {d.signatureDirecteur && (
                        <div className="mt-2 rounded-lg bg-purple-50 border border-purple-200 px-3 py-2 text-xs text-purple-700">
                          {d.signatureDirecteur}
                        </div>
                      )}
                    </div>
                    {/* ── Partie droite : actions contextuelles ── */}
                    {(fa || fs) ? (
                      /* ── CARTE FACTURÉE : rendu simplifié (vue transversale → actions dans le dossier) ── */
                      <div className="shrink-0 flex flex-col gap-2 items-end">
                        {fa && (
                          <div className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                            fa.acompteVerse
                              ? 'border-[var(--color-success)]/20 bg-[var(--color-success-light)] text-[var(--color-success)]'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}>
                            Facture acompte — {fa.numero} — {fa.montantFacture.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            {fa.acompteVerse
                              ? <span className="ml-1">· Reçu : {Number(fa.montantVerseTotal ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € · Acompte validé ✓</span>
                              : (fa.montantVerseTotal ?? 0) > 0
                                ? <span className="ml-1">· Reçu : {Number(fa.montantVerseTotal).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                : <span className="ml-1">· En attente de paiement</span>
                            }
                          </div>
                        )}

                        {fs && (
                          <div className={`rounded-lg border px-4 py-2 text-xs font-semibold ${
                            (fs.montantVerseTotal ?? 0) >= fs.montantFacture * 0.99
                              ? 'border-teal-200 bg-teal-50 text-teal-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}>
                            Facture solde — {fs.numero} — {fs.montantFacture.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                            {(fs.montantVerseTotal ?? 0) >= fs.montantFacture * 0.99
                              ? ' · Soldé ✓'
                              : ` · Reste : ${(fs.montantFacture - (fs.montantVerseTotal ?? 0)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €`
                            }
                          </div>
                        )}

                        {/* PDF de la dernière facture émise */}
                        {(fs?.pdfUrl || fa?.pdfUrl) && (
                          <a
                            href={(fs?.pdfUrl ?? fa?.pdfUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            PDF
                          </a>
                        )}

                        {/* Ajuster les lignes avant d'émettre le solde (acompte figé, solde sur total révisé) */}
                        {fa && !fs && (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') && (
                          <Link
                            href={`/dashboard/hebergeur/devis/${d.id}/modifier`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-4 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                            </svg>
                            Ajuster avant solde
                          </Link>
                        )}

                        {/* Lien principal → dossier */}
                        {sejourId && (
                          <Link
                            href={`/dashboard/sejour/${sejourId}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors"
                          >
                            Ouvrir le dossier
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        )}
                      </div>
                    ) : (
                      /* ── CARTE SANS FACTURE : actions d'édition / émission ── */
                      <>
                        <DevisPDFButton
                          key={`pdf-${d.id}-${d.demande?.nombreEleves ?? 0}-${d.demande?.nombreAccompagnateurs ?? 0}`}
                          data={buildPdfProps(d)}
                          filename={`devis-${(d.numeroDevis ?? d.id).substring(0, 8)}.pdf`}
                          label="PDF"
                        />
                        {['SELECTIONNE', 'SIGNE_DIRECTION'].includes(d.statut) && (
                          <button
                            onClick={() => setModalAnnulerId(d.id)}
                            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Annuler ce devis
                          </button>
                        )}
                        {['EN_ATTENTE', 'EN_ATTENTE_VALIDATION'].includes(d.statut) && (
                          <Link
                            href={`/dashboard/hebergeur/devis/${d.id}/modifier`}
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
                            <DevisPDFButton
                              key={`pdf-${d.id}-${d.demande?.nombreEleves ?? 0}-${d.demande?.nombreAccompagnateurs ?? 0}`}
                              data={buildPdfProps(d)}
                              filename={`devis-${(d.numeroDevis ?? d.id).substring(0, 8)}.pdf`}
                            />
                            <button
                              onClick={() => handleFacturerAcompte(d.id)}
                              disabled={facturantId === d.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                            >
                              {facturantId === d.id ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              ) : null}
                              Émettre la facture d&apos;acompte
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modale double-confirmation annulation devis ─── */}
      {modalAnnulerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !annulerLoading && setModalAnnulerId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Annuler ce devis ?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous certain de vouloir annuler ce devis ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModalAnnulerId(null)}
                disabled={annulerLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler — revenir
              </button>
              <button
                onClick={handleConfirmerAnnulation}
                disabled={annulerLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {annulerLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
