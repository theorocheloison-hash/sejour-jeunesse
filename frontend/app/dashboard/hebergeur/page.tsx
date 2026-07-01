'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { getMesDevis, getFactureAcompte, getFactureSolde } from '@/src/lib/devis';
import type { Devis } from '@/src/lib/devis';
import { getMesSejoursPlanning } from '@/src/lib/collaboration';
import type { SejourPlanning } from '@/src/lib/collaboration';
import { getDisponibilites } from '@/src/lib/centre';
import type { Disponibilite } from '@/src/lib/centre';
import { getAbonnementStatut } from '@/src/lib/abonnement';
import { PLANNING_COULEURS, derivePlanningStatut } from '@/src/lib/planning-statut';
import { getJourFerie, getVacancesZones } from '@/src/data/calendrier-france';

// ─── CA confirmé : helpers réutilisables ─────────────────────────────────────
type PeriodeCA = 'DDA' | 'DDM' | 'T1' | 'T2' | 'T3' | 'T4';

const STATUTS_CA = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

/** Date de début du séjour d'un devis (collab → demande.sejour, direct → sejourDirect, fallback createdAt). */
function resolveSejourDateDebut(d: Devis): string {
  return d.demande?.sejour?.dateDebut ?? d.sejourDirect?.dateDebut ?? d.createdAt;
}

/** Date de fin du séjour d'un devis (aligné avec devisAlertes.ts). */
function resolveSejourDateFin(d: Devis): string {
  return d.demande?.sejour?.dateFin ?? d.sejourDirect?.dateFin ?? resolveSejourDateDebut(d);
}

/** Id du séjour d'un devis (pour compter les séjours distincts). */
function resolveSejourId(d: Devis): string | null {
  return d.demande?.sejour?.id ?? d.sejourDirect?.id ?? null;
}

/** Bornes [start, end] d'une période CA pour l'année en cours. */
function getPeriodeBounds(periode: PeriodeCA): { start: Date; end: Date } {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  switch (periode) {
    case 'DDA': return { start: new Date(year, 0, 1), end: endOfYear };
    case 'DDM': return { start: new Date(year, month, 1), end: endOfYear };
    case 'T1':  return { start: new Date(year, 0, 1),  end: new Date(year, 2, 31, 23, 59, 59) };
    case 'T2':  return { start: new Date(year, 3, 1),  end: new Date(year, 5, 30, 23, 59, 59) };
    case 'T3':  return { start: new Date(year, 6, 1),  end: new Date(year, 8, 30, 23, 59, 59) };
    case 'T4':  return { start: new Date(year, 9, 1),  end: endOfYear };
  }
}

/** CA TTC confirmé (devis signés, hors complémentaires) filtré par date de séjour ∈ [start, end]. */
function computeCAConfirme(devis: Devis[], start: Date, end: Date): { montant: number; nbSejours: number } {
  const sejourIds = new Set<string>();
  let montant = 0;
  for (const d of devis) {
    if (d.isComplementaire) continue;
    if (!STATUTS_CA.includes(d.statut)) continue;
    const dd = new Date(resolveSejourDateDebut(d));
    if (dd < start || dd > end) continue;
    montant += d.montantTTC ?? Number(d.montantTotal) ?? 0;
    const sid = resolveSejourId(d);
    if (sid) sejourIds.add(sid);
  }
  return { montant, nbSejours: sejourIds.size };
}

// ─── Helpers planning compact ─────────────────────────────────────────────────

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const HACHURES_BG = `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)`;

export default function HebergeurDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [devis, setDevis] = useState<Devis[]>([]);
  const [sejours, setSejours] = useState<SejourPlanning[]>([]);
  const [dispos, setDispos] = useState<Disponibilite[]>([]);
  const [periodeCA, setPeriodeCA] = useState<PeriodeCA>('DDA');
  const [essaiActif, setEssaiActif] = useState(false);
  const [essaiExpire, setEssaiExpire] = useState(false);
  const [joursRestants, setJoursRestants] = useState(0);
  const [abonnementActif, setAbonnementActif] = useState(true);
  const [claimStatut, setClaimStatut] = useState<string | null>(null);
  const [claimOrgNom, setClaimOrgNom] = useState<string | null>(null);
  const [centresPending, setCentresPending] = useState<{ id: string; nom: string; claimDocumentUrl: string | null }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [mesDevis, mesSejoursPlanning, mesDispos] = await Promise.all([
        getMesDevis(),
        getMesSejoursPlanning(),
        getDisponibilites(),
      ]);
      setDevis(mesDevis);
      setSejours(mesSejoursPlanning);
      setDispos(mesDispos);

      const aboStatut = await getAbonnementStatut().catch(() => null);
      if (aboStatut) {
        setEssaiActif(aboStatut.isTrial);
        setEssaiExpire(aboStatut.trialExpire);
        setJoursRestants(aboStatut.joursRestants);
        setAbonnementActif(aboStatut.actif);
      }
    } catch {}

    // Claim status + centres pending (hors Promise.all car non critique)
    const claimData = await api
      .get('/organisations/mon-claim-statut')
      .then((r) => r.data ?? null)
      .catch(() => null);
    setClaimStatut(claimData?.claimStatut ?? null);
    setClaimOrgNom(claimData?.organisationNom ?? null);

    const pend = await api
      .get('/centres/mes-centres-pending')
      .then((r) => r.data ?? [])
      .catch(() => []);
    setCentresPending(pend);
  }, []);

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') loadData();
  }, [user, loadData]);

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // ── KPIs ──
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // CA confirmé
    const caBounds = getPeriodeBounds(periodeCA);
    const ca = computeCAConfirme(devis, caBounds.start, caBounds.end);

    // Devis en attente — aligné avec l'onglet "attente" de la page devis
    const devisAttente = devis.filter(d => {
      if (d.isComplementaire) return false;
      const fa = getFactureAcompte(d);
      const fs = getFactureSolde(d);
      return (d.statut === 'EN_ATTENTE' || d.statut === 'EN_ATTENTE_VALIDATION') && !fa && !fs;
    });

    // À facturer — aligné avec l'onglet "a-facturer" (utilise resolveSejourDateFin)
    const aFacturer = devis.filter(d => {
      if (d.isComplementaire) return false;
      const fa = getFactureAcompte(d);
      const fs = getFactureSolde(d);
      return (
        ((d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') && !fa && !fs)
        || (!!fa && !fs && new Date(resolveSejourDateFin(d)) < today)
      );
    });

    // Impayés — factures émises non intégralement réglées, hors avoirs/acomptes validés/complémentaires
    let impayesAcompteCount = 0;
    let impayesSoldeCount = 0;
    let impayesMontant = 0;
    for (const d of devis) {
      if (d.isComplementaire) continue;
      for (const f of d.factures ?? []) {
        if (f.typeFacture === 'AVOIR') continue;
        if (f.typeFacture === 'ACOMPTE' && f.acompteVerse) continue;
        const verse = f.montantVerseTotal ?? 0;
        if (verse < f.montantFacture) {
          if (f.typeFacture === 'SOLDE') impayesSoldeCount++;
          else impayesAcompteCount++;
          impayesMontant += f.montantFacture - verse;
        }
      }
    }
    const impayesCount = impayesAcompteCount + impayesSoldeCount;
    const impayesTab = impayesSoldeCount > 0 ? 'suivi-soldes' : 'suivi-acomptes';

    return {
      ca, caBounds,
      devisAttenteCount: devisAttente.length,
      devisAttenteMontant: devisAttente.reduce((s, d) => s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0),
      aFacturerCount: aFacturer.length,
      aFacturerMontant: aFacturer.reduce((s, d) => s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0),
      impayesCount, impayesMontant, impayesTab,
    };
  }, [devis, periodeCA]);

  // ── Données planning compact ──
  const planningData = useMemo(() => {
    const today = new Date();
    const thisMonday = startOfWeek(today);
    const prevMonday = addDays(thisMonday, -7);

    const days: Date[] = Array.from({ length: 21 }, (_, i) => addDays(prevMonday, i));

    const weeks = [
      { label: 'Semaine précédente', days: days.slice(0, 7) },
      { label: 'Cette semaine', days: days.slice(7, 14) },
      { label: 'Semaine prochaine', days: days.slice(14, 21) },
    ];

    const couleurBySejour = Object.fromEntries(
      sejours.map((s) => [s.id, PLANNING_COULEURS[derivePlanningStatut(s)]])
    );

    const sejoursForDay = (dayStr: string) =>
      sejours.filter(s => {
        if (!s.dateDebut || !s.dateFin) return false;
        const start = s.dateDebut.split('T')[0];
        const end = s.dateFin.split('T')[0];
        return dayStr >= start && dayStr <= end;
      });

    const disposForDay = (dayStr: string) =>
      dispos.filter(d => {
        const start = d.dateDebut.split('T')[0];
        const end = d.dateFin.split('T')[0];
        return dayStr >= start && dayStr <= end;
      });

    return { weeks, couleurBySejour, sejoursForDay, disposForDay };
  }, [sejours, dispos]);

  if (isLoading || !user) return null;

  const annee = new Date().getFullYear();
  const caPeriodeLabel = (periodeCA === 'DDA' || periodeCA === 'DDM')
    ? `Depuis le ${kpis.caBounds.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${periodeCA} ${annee}`;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-bg)]">

      {/* ── Bannières système (full-width) ── */}
      {claimStatut === 'EN_ATTENTE_DOCUMENT' && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <p className="text-sm text-amber-800">
            <strong>Revendication en cours{claimOrgNom ? ` — ${claimOrgNom}` : ''}</strong> — Votre Kbis est attendu pour valider
            la propriété de votre centre. <a href="/dashboard/hebergeur/documents"
            className="underline font-medium">Déposer le document →</a>
          </p>
        </div>
      )}
      {claimStatut === 'EN_ATTENTE_VALIDATION' && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <p className="text-sm text-blue-800">
            <strong>Validation en cours</strong> — Votre demande de revendication
            {claimOrgNom ? ` pour ${claimOrgNom}` : ''} est en cours de validation.
            Vous recevrez un email dès qu&apos;elle sera traitée.
          </p>
        </div>
      )}

      {centresPending.map((c) => (
        <div key={c.id} className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <p className="text-sm text-amber-800">
            <strong>Demande pour {c.nom} en attente de validation</strong> — notre équipe examine votre demande.
            {!c.claimDocumentUrl && (
              <>
                {' '}
                <Link href="/dashboard/hebergeur/documents" className="underline font-medium">
                  Déposer un justificatif →
                </Link>
              </>
            )}
          </p>
        </div>
      ))}

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 w-full">

        {/* ── Bannières essai / abonnement ── */}
        {essaiActif && (
          <div className={`flex items-center justify-between gap-3 rounded-lg border px-5 py-3 ${joursRestants > 7 ? 'bg-amber-50 border-amber-500' : 'bg-red-50 border-red-700'}`}>
            <span className="text-sm text-[var(--color-primary)]">
              {joursRestants > 0
                ? `Essai gratuit — il vous reste ${joursRestants} jour${joursRestants > 1 ? 's' : ''} d'accès complet.`
                : `Votre essai gratuit a expiré. Choisissez un plan pour continuer.`}
            </span>
            <a href="/dashboard/hebergeur/abonnement" className="text-[13px] font-semibold text-[var(--color-primary)] underline whitespace-nowrap">
              Voir les plans →
            </a>
          </div>
        )}

        {essaiExpire && !essaiActif && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-700 bg-red-50 px-5 py-3">
            <span className="text-sm font-medium text-red-800">
              Votre essai gratuit a expiré. Activez un abonnement pour retrouver l&apos;accès complet.
            </span>
            <a href="/dashboard/hebergeur/abonnement" className="text-[13px] font-semibold text-red-800 underline whitespace-nowrap">
              Choisir un plan →
            </a>
          </div>
        )}

        {!abonnementActif && !essaiActif && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-700">Abonnement inactif — accès aux demandes limité.</p>
            <Link href="/dashboard/hebergeur/abonnement" className="text-xs font-semibold text-amber-700 underline hover:no-underline">
              Activer
            </Link>
          </div>
        )}

        {/* ── Zone 1 : KPI CA confirmé ── */}
        <Link
          href="/dashboard/hebergeur/pilotage"
          title="Chiffre d'affaires TTC des devis signés — Voir le détail dans Pilotage"
          className="group block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">CA confirmé</p>
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[var(--color-primary)]">{fmt(kpis.ca.montant)} €</p>
          <p className="text-xs text-gray-400 mt-1">{kpis.ca.nbSejours} séjour{kpis.ca.nbSejours > 1 ? 's' : ''} · {caPeriodeLabel}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {(['DDA', 'DDM', 'T1', 'T2', 'T3', 'T4'] as PeriodeCA[]).map((p) => (
              <button
                key={p}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPeriodeCA(p); }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${periodeCA === p ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </Link>

        {/* ── Zone 2 : 3 cartes alertes ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* Devis en attente */}
          <Link href="/dashboard/hebergeur/devis?tab=attente" className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Devis en attente</p>
              <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-orange-600">{kpis.devisAttenteCount} devis</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(kpis.devisAttenteMontant)} €</p>
          </Link>

          {/* À facturer */}
          <Link href="/dashboard/hebergeur/devis?tab=a-facturer" className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">À facturer</p>
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-amber-600">{kpis.aFacturerCount} facture{kpis.aFacturerCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(kpis.aFacturerMontant)} €</p>
          </Link>

          {/* Impayés */}
          <Link href={`/dashboard/hebergeur/devis?tab=${kpis.impayesTab}`} className="block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Impayés</p>
              <svg className={`w-4 h-4 ${kpis.impayesCount > 0 ? 'text-red-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${kpis.impayesCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpis.impayesCount} facture{kpis.impayesCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.impayesCount > 0 ? `${fmt(kpis.impayesMontant)} €` : 'Aucun impayé'}</p>
          </Link>

        </div>

        {/* ── Zone 3 : Planning compact 3 semaines ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Planning</h2>
            <Link
              href="/dashboard/hebergeur/planning"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors"
            >
              Voir le planning complet
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header jours de la semaine */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100 last:border-0">{d}</div>
              ))}
            </div>

            {/* 3 lignes de semaines */}
            {planningData.weeks.map((week, wi) => (
              <div key={wi}>
                <div className="grid grid-cols-7 border-b border-gray-100 last:border-0">
                  {week.days.map((day, di) => {
                    const ds = dateStr(day);
                    const isToday = ds === dateStr(new Date());
                    const sj = planningData.sejoursForDay(ds);
                    const disposJour = planningData.disposForDay(ds);
                    const jourFerie = getJourFerie(ds);
                    const vacances = getVacancesZones(ds);
                    return (
                      <div
                        key={di}
                        className={`h-24 border-r border-gray-100 last:border-0 p-1 overflow-hidden cursor-pointer ${isToday ? 'bg-blue-50 hover:bg-blue-100/70' : jourFerie ? 'bg-red-50 hover:bg-red-100/50' : vacances ? 'bg-purple-50/40 hover:bg-purple-100/40' : 'hover:bg-gray-50'}`}
                        onClick={() => router.push(`/dashboard/hebergeur/planning?date=${ds}&view=semaine`)}
                      >
                        <p className={`text-xs font-medium ${isToday ? 'text-[var(--color-primary)] font-bold' : 'text-gray-600'}`}>
                          {day.getDate()}
                        </p>
                        {jourFerie && (
                          <span className="block text-[10px] text-red-500 font-medium truncate leading-tight">{jourFerie}</span>
                        )}
                        {vacances && (
                          <span className="block text-[9px] text-purple-500 font-medium truncate leading-tight mb-0.5">Vac. {vacances.zones}</span>
                        )}
                        {disposJour.length > 0 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs rounded px-1 truncate mb-0.5"
                            style={{
                              backgroundColor: PLANNING_COULEURS.INDISPONIBLE.bg,
                              color: PLANNING_COULEURS.INDISPONIBLE.text,
                              backgroundImage: HACHURES_BG,
                            }}
                          >
                            Indisponible
                          </div>
                        )}
                        {sj.map(s => {
                          const c = planningData.couleurBySejour[s.id];
                          const isOption = s.statut === 'OPTION';
                          const isEvenement = s.natureSejour === 'EVENEMENT';
                          return (
                            <Link
                              key={s.id}
                              href={`/dashboard/sejour/${s.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="block text-xs px-1 rounded truncate mb-0.5"
                              style={{
                                backgroundColor: c?.bg ?? '#6B7280',
                                color: c?.text ?? '#fff',
                                ...(c?.hachures && { backgroundImage: HACHURES_BG }),
                              }}
                            >
                              {isOption ? '⏳ ' : ''}{isEvenement ? '🎉 ' : ''}{s.titre}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Légende */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap mt-2">
            <span className="font-medium text-gray-700">Légende :</span>
            {Object.entries(PLANNING_COULEURS).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{
                    backgroundColor: val.bg,
                    ...(val.hachures && {
                      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)`,
                    }),
                  }}
                />
                {val.label}
              </span>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
