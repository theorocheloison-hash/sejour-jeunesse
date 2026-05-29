'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDashboardGlobal } from '@/src/lib/centre';
import { PLANNING_COULEURS, COULEUR_DEMANDE_ATTENTE, derivePlanningStatut } from '@/src/lib/planning-statut';

// ─── Types ───────────────────────────────────────────────────────────────

type Periode = 'mois' | 'trimestre' | 'annee';

interface CentreCard {
  id: string;
  nom: string;
  ville: string;
  capacite: number;
  imageUrl: string | null;
  devisEnAttente?: number;
  sejoursActifs?: number;
}

interface DemandeATraiter {
  id: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  nombreEleves: number;
  dateButoireReponse: string | null;
  centreDestinataireId: string | null;
  enseignant: { prenom: string; nom: string } | null;
}

interface DevisATraiter {
  id: string;
  centreId: string;
  montantTTC: number | null;
  createdAt: string;
  statut: string;
  demande: { titre: string; dateButoireReponse: string | null; dateDebut: string; dateFin: string; nombreEleves: number } | null;
}

interface DevisAFacturer {
  id: string;
  centreId: string;
  montantTTC: number | null;
  montantAcompte?: number | null;
  montantVerseTotal?: number;
  statut: string;
  demande: { titre: string; dateDebut: string; dateFin: string } | null;
}

interface FactureImpayee {
  id: string;
  centreId: string;
  montantTTC: number | null;
  montantVerseTotal: number;
  statut: string;
  dateFacture: string | null;
  numeroFacture: string | null;
  demande: { titre: string } | null;
}

interface DevisLibreImpayee {
  id: string;
  centreId: string;
  montantTTC: number | null;
  montantVerseTotal: number;
  numeroDevis: string | null;
  client: { nom: string } | null;
}

interface SejourPlanning {
  id: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  placesTotales: number;
  statut: string;
  hebergementSelectionneId: string;
  devisDirect?: Array<{ statut: string }>;
  demandes?: Array<{ devis?: Array<{ statut: string }> }>;
}

interface OptionPlanning {
  id: string;
  titre: string;
  dateDebut: string;
  dateFin: string;
  participants: number;
  centreId: string;
  type: 'OPTION';
}

interface DashboardData {
  centres: CentreCard[];
  kpis: {
    aTraiter: { total: number; urgents: number; description: string };
    aFacturer: { total: number; montant: number; description: string };
    paiementsEnAttente: { total: number; montant: number; description: string };
    chiffreAffaires: { encaisse: number; previsionnel: number; periodeDebut: string; periodeFin: string; description: string };
  };
  aTraiterDetail: { demandes: DemandeATraiter[]; devis: DevisATraiter[] };
  aFacturerDetail: { acomptes: DevisAFacturer[]; soldes: DevisAFacturer[] };
  paiementsDetail: { factures: FactureImpayee[]; devisLibres: DevisLibreImpayee[] };
  planning: { sejours: SejourPlanning[]; options: OptionPlanning[] };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const fmtEUR = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEUR0 = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtDateShort = (s: string) => {
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fmtDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

const isUrgent = (dateButoire: string | null): boolean => {
  if (!dateButoire) return false;
  const diff = daysBetween(new Date(), new Date(dateButoire));
  return diff <= 7 && diff >= 0;
};

const computePeriode = (p: Periode): { debut: string; fin: string } => {
  const now = new Date();
  if (p === 'mois') {
    return {
      debut: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      fin: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    };
  }
  if (p === 'trimestre') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      debut: new Date(now.getFullYear(), q * 3, 1).toISOString(),
      fin: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59).toISOString(),
    };
  }
  return {
    debut: new Date(now.getFullYear(), 0, 1).toISOString(),
    fin: new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString(),
  };
};

// ─── Page ────────────────────────────────────────────────────────────────

export default function DashboardGlobalPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isMultiCentre } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<Periode>('annee');

  const aTraiterRef = useRef<HTMLDivElement | null>(null);
  const aFacturerRef = useRef<HTMLDivElement | null>(null);
  const paiementsRef = useRef<HTMLDivElement | null>(null);

  // Redirect si mono-centre
  useEffect(() => {
    if (!authLoading && user && user.role === 'HEBERGEUR' && !isMultiCentre) {
      router.replace('/dashboard/hebergeur');
    }
  }, [authLoading, user, isMultiCentre, router]);

  const loadData = useCallback(async (p: Periode) => {
    setLoading(true);
    setError(null);
    const { debut, fin } = computePeriode(p);
    try {
      const res = await getDashboardGlobal(debut, fin);
      setData(res as DashboardData | null);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Impossible de charger le dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'HEBERGEUR' && isMultiCentre) {
      loadData(periode);
    }
  }, [authLoading, user, isMultiCentre, periode, loadData]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNouveauCentre = () => {
    router.push('/dashboard/hebergeur/centres/nouveau');
  };

  const handleGererCentre = (centreId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('liavo-centre-actif', centreId);
    }
    router.push('/dashboard/hebergeur');
  };

  // ─── Planning timeline calculation ───
  const planning = useMemo(() => {
    if (!data) return null;
    const startMonday = new Date();
    startMonday.setHours(0, 0, 0, 0);
    const day = startMonday.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    startMonday.setDate(startMonday.getDate() + diffToMonday);
    const totalDays = 56; // 8 weeks
    const endDate = new Date(startMonday);
    endDate.setDate(endDate.getDate() + totalDays);

    const weeks: Date[] = [];
    for (let i = 0; i < 8; i++) {
      const w = new Date(startMonday);
      w.setDate(w.getDate() + i * 7);
      weeks.push(w);
    }

    const positionBlock = (debut: string, fin: string) => {
      const d = new Date(debut);
      const f = new Date(fin);
      const startDay = Math.max(0, daysBetween(startMonday, d));
      const endDay = Math.min(totalDays, daysBetween(startMonday, f) + 1);
      if (endDay <= 0 || startDay >= totalDays) return null;
      return {
        leftPct: (startDay / totalDays) * 100,
        widthPct: ((endDay - startDay) / totalDays) * 100,
      };
    };

    return { startMonday, endDate, totalDays, weeks, positionBlock };
  }, [data]);

  // ─── Lookup centre par id ───
  const centreById = useMemo(() => {
    const m = new Map<string, CentreCard>();
    data?.centres.forEach(c => m.set(c.id, c));
    return m;
  }, [data]);

  // ─── Rendering ───
  if (authLoading || (!data && loading && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (!user || user.role !== 'HEBERGEUR') return null;
  if (!isMultiCentre) return null;

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-md text-center">
          <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          <button
            onClick={() => loadData(periode)}
            className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.centres.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Aucun centre rattaché à votre compte.</p>
      </div>
    );
  }

  // ─── KPIs cards ───
  const aTraiterUrgent = data.kpis.aTraiter.urgents > 0;
  const aFacturerColor = data.kpis.aFacturer.total > 0 ? 'var(--color-danger)' : '#9CA3AF';
  const paiementsColor = data.kpis.paiementsEnAttente.total > 0 ? 'var(--color-warning)' : '#9CA3AF';

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="text-2xl" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Mes centres</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Vue consolidée sur vos {data.centres.length} centres
            </p>
          </div>
          <button
            type="button"
            onClick={handleNouveauCentre}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition"
            style={{ background: 'var(--color-primary)' }}
          >
            + Nouveau centre
          </button>
        </div>

        {/* ── KPIs ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* KPI 1 — À traiter */}
          <button
            type="button"
            onClick={() => scrollTo(aTraiterRef)}
            className="text-left bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition p-6 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>À traiter</span>
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z" />
              </svg>
            </div>
            <div className="text-3xl text-gray-900" style={{ fontWeight: 600 }}>{data.kpis.aTraiter.total}</div>
            {aTraiterUrgent && (
              <span
                className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'var(--color-danger-light)', color: 'var(--color-danger)' }}
                title="Date butoire dans moins de 7 jours"
              >
                {data.kpis.aTraiter.urgents} urgent{data.kpis.aTraiter.urgents > 1 ? 's' : ''}
              </span>
            )}
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.kpis.aTraiter.description}</p>
          </button>

          {/* KPI 2 — À facturer */}
          <button
            type="button"
            onClick={() => scrollTo(aFacturerRef)}
            className="text-left bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition p-6 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>À facturer</span>
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke={aFacturerColor} strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="text-3xl text-gray-900" style={{ fontWeight: 600 }}>{data.kpis.aFacturer.total}</div>
            <div
              className="mt-1 text-sm"
              style={{ color: aFacturerColor, fontWeight: 500 }}
              title="Somme des acomptes à émettre + soldes à facturer sur les séjours terminés"
            >
              {fmtEUR(data.kpis.aFacturer.montant)}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.kpis.aFacturer.description}</p>
          </button>

          {/* KPI 3 — Paiements en attente */}
          <button
            type="button"
            onClick={() => scrollTo(paiementsRef)}
            className="text-left bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition p-6 cursor-pointer"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Paiements en attente</span>
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke={paiementsColor} strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl text-gray-900" style={{ fontWeight: 600 }}>{data.kpis.paiementsEnAttente.total}</div>
            <div
              className="mt-1 text-sm"
              style={{ color: paiementsColor, fontWeight: 500 }}
              title="Factures émises dont le règlement n'a pas encore été enregistré"
            >
              {fmtEUR(data.kpis.paiementsEnAttente.montant)}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>{data.kpis.paiementsEnAttente.description}</p>
          </button>

          {/* KPI 4 — Chiffre d'affaires */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start justify-between mb-3 gap-2">
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Chiffre d&apos;affaires</span>
              <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="#10B981" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {(['mois', 'trimestre', 'annee'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setPeriode(p); }}
                  className="px-2 py-0.5 text-xs rounded transition"
                  style={{
                    background: periode === p ? 'var(--color-primary-light)' : 'transparent',
                    color: periode === p ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: periode === p ? 500 : 400,
                    border: '1px solid',
                    borderColor: periode === p ? 'var(--color-primary-light)' : 'transparent',
                  }}
                >
                  {p === 'mois' ? 'Mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
                </button>
              ))}
            </div>
            <div title="Somme des paiements reçus sur la période sélectionnée">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Encaissé</span>
              <div className="text-2xl text-gray-900" style={{ fontWeight: 600 }}>{fmtEUR0(data.kpis.chiffreAffaires.encaisse)}</div>
            </div>
            <div className="mt-2" title="Montant restant à encaisser sur les devis signés (montant total - déjà versé)">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Prévisionnel</span>
              <div className="text-base" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>{fmtEUR0(data.kpis.chiffreAffaires.previsionnel)}</div>
            </div>
          </div>
        </div>

        {/* ── Planning ────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-lg" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Planning</h2>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>(8 prochaines semaines)</span>
          </div>
          {planning && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <div style={{ minWidth: 800 }}>
                  {/* Header semaines */}
                  <div className="flex border-b border-gray-100">
                    <div className="shrink-0" style={{ width: 180, padding: '10px 14px', background: '#FAFAF9', borderRight: '1px solid #F3F4F6' }}>
                      <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>Centre</span>
                    </div>
                    <div className="flex-1 flex relative">
                      {planning.weeks.map((w, i) => (
                        <div key={i} className="flex-1 text-center" style={{ padding: '10px 4px', borderRight: i < 7 ? '1px solid #F3F4F6' : 'none', background: '#FAFAF9' }}>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDateShort(w.toISOString())}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Lignes centres */}
                  {data.centres.map((c, idx) => {
                    const sejoursCentre = data.planning.sejours.filter(s => s.hebergementSelectionneId === c.id);
                    const optionsCentre = data.planning.options.filter(o => o.centreId === c.id);
                    return (
                      <div key={c.id} className="flex" style={{ borderBottom: idx === data.centres.length - 1 ? 'none' : '1px solid #F3F4F6' }}>
                        <div className="shrink-0" style={{ width: 180, padding: '14px', borderRight: '1px solid #F3F4F6' }}>
                          <p className="text-sm text-gray-900 truncate" style={{ fontWeight: 500 }}>{c.nom}</p>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{c.capacite} places</p>
                        </div>
                        <div className="flex-1 relative" style={{ minHeight: 64 }}>
                          {/* Gridlines */}
                          <div className="absolute inset-0 flex pointer-events-none">
                            {planning.weeks.map((_, i) => (
                              <div key={i} className="flex-1" style={{ borderRight: i < 7 ? '1px solid #F3F4F6' : 'none' }} />
                            ))}
                          </div>
                          {/* Séjours */}
                          {sejoursCentre.map(s => {
                            const pos = planning.positionBlock(s.dateDebut, s.dateFin);
                            if (!pos) return null;
                            const couleur = PLANNING_COULEURS[derivePlanningStatut(s)] ?? PLANNING_COULEURS.CONFIRME;
                            return (
                              <div
                                key={s.id}
                                title={`${s.titre}\n${fmtDate(s.dateDebut)} → ${fmtDate(s.dateFin)}\n${s.placesTotales} participants\nStatut : ${couleur.label}`}
                                className="absolute rounded-md px-2 py-1 text-xs truncate shadow-sm"
                                style={{
                                  left: `${pos.leftPct}%`,
                                  width: `calc(${pos.widthPct}% - 4px)`,
                                  top: 8,
                                  height: 22,
                                  background: couleur.bg,
                                  ...(couleur.hachures && { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)' }),
                                  color: couleur.text,
                                  fontWeight: 500,
                                  lineHeight: '14px',
                                  cursor: 'help',
                                }}
                              >
                                {s.placesTotales} pers.
                              </div>
                            );
                          })}
                          {/* Options */}
                          {optionsCentre.map(o => {
                            const pos = planning.positionBlock(o.dateDebut, o.dateFin);
                            if (!pos) return null;
                            return (
                              <div
                                key={o.id}
                                title={`${o.titre}\n${fmtDate(o.dateDebut)} → ${fmtDate(o.dateFin)}\n${o.participants} participants\nDemande en attente`}
                                className="absolute rounded-md px-2 py-1 text-xs truncate"
                                style={{
                                  left: `${pos.leftPct}%`,
                                  width: `calc(${pos.widthPct}% - 4px)`,
                                  top: 36,
                                  height: 22,
                                  background: COULEUR_DEMANDE_ATTENTE.bg,
                                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)',
                                  color: COULEUR_DEMANDE_ATTENTE.text,
                                  fontWeight: 500,
                                  lineHeight: '14px',
                                  cursor: 'help',
                                }}
                              >
                                {o.participants} pers.
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Légende */}
              <div className="flex items-center gap-4 px-4 py-3 flex-wrap" style={{ borderTop: '1px solid #F3F4F6', background: '#FAFAF9' }}>
                {[
                  PLANNING_COULEURS.OPTION,
                  PLANNING_COULEURS.CONFIRME,
                  PLANNING_COULEURS.ACOMPTE_VERSE,
                  PLANNING_COULEURS.SOLDE,
                  COULEUR_DEMANDE_ATTENTE,
                ].map(val => (
                  <div key={val.label} className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded"
                      style={{
                        background: val.bg,
                        ...(val.hachures && { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.4) 2px, rgba(255,255,255,0.4) 4px)' }),
                      }}
                    />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{val.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Cartes centres ──────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="text-lg mb-4" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Mes centres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.centres.map(c => (
              <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition overflow-hidden flex flex-col">
                <div
                  className="h-36 w-full"
                  style={{
                    background: c.imageUrl
                      ? `url('${c.imageUrl}') center/cover no-repeat`
                      : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))',
                  }}
                />
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-base text-gray-900" style={{ fontWeight: 600 }}>{c.nom}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{c.ville}</p>
                  <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {c.capacite} places · {c.sejoursActifs ?? 0} séjour{(c.sejoursActifs ?? 0) > 1 ? 's' : ''} actif{(c.sejoursActifs ?? 0) > 1 ? 's' : ''}
                  </p>
                  {(c.devisEnAttente ?? 0) > 0 && (
                    <span
                      className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium self-start"
                      style={{ background: 'var(--color-warning-light)', color: 'var(--color-warning)' }}
                    >
                      {c.devisEnAttente} devis en attente
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleGererCentre(c.id)}
                    className="mt-4 w-full rounded-lg px-3 py-2 text-sm transition hover:opacity-90"
                    style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 500 }}
                  >
                    Gérer ce centre →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Détail : À traiter ──────────────────────────────── */}
        <section ref={aTraiterRef} id="a-traiter" className="mb-10 scroll-mt-6">
          <h2 className="text-lg" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Détail : À traiter</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Demandes reçues auxquelles vous n&apos;avez pas encore répondu, et devis envoyés en attente de validation par l&apos;organisateur.
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#FAFAF9', borderBottom: '1px solid #F3F4F6' }}>
                  <tr>
                    <Th>Centre</Th>
                    <Th>Titre</Th>
                    <Th>Type</Th>
                    <Th>Date butoire</Th>
                    <Th align="right">Participants</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.aTraiterDetail.demandes.length === 0 && data.aTraiterDetail.devis.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>Rien à traiter.</td></tr>
                  )}
                  {data.aTraiterDetail.demandes.map(d => (
                    <tr key={`dem-${d.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <Td>{d.centreDestinataireId ? centreById.get(d.centreDestinataireId)?.nom ?? '—' : 'Tous les centres'}</Td>
                      <Td>{d.titre}</Td>
                      <Td><Pill color="#7C3AED">Demande</Pill></Td>
                      <Td>
                        {d.dateButoireReponse ? fmtDate(d.dateButoireReponse) : '—'}
                        {isUrgent(d.dateButoireReponse) && (
                          <Pill color="var(--color-danger)" ml>Urgent</Pill>
                        )}
                      </Td>
                      <Td align="right">{d.nombreEleves}</Td>
                      <Td>OUVERTE</Td>
                    </tr>
                  ))}
                  {data.aTraiterDetail.devis.map(d => (
                    <tr key={`dev-${d.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <Td>{centreById.get(d.centreId)?.nom ?? '—'}</Td>
                      <Td>{d.demande?.titre ?? '—'}</Td>
                      <Td><Pill color="var(--color-primary)">Devis envoyé</Pill></Td>
                      <Td>
                        {d.demande?.dateButoireReponse ? fmtDate(d.demande.dateButoireReponse) : '—'}
                        {isUrgent(d.demande?.dateButoireReponse ?? null) && (
                          <Pill color="var(--color-danger)" ml>Urgent</Pill>
                        )}
                      </Td>
                      <Td align="right">{d.demande?.nombreEleves ?? '—'}</Td>
                      <Td>{d.statut}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Détail : À facturer ─────────────────────────────── */}
        <section ref={aFacturerRef} id="a-facturer" className="mb-10 scroll-mt-6">
          <h2 className="text-lg" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Détail : À facturer</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Séjours dont le devis est signé mais dont la facture n&apos;a pas encore été émise (acompte), ou séjours terminés dont le solde reste à facturer.
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#FAFAF9', borderBottom: '1px solid #F3F4F6' }}>
                  <tr>
                    <Th>Centre</Th>
                    <Th>Séjour</Th>
                    <Th>Type</Th>
                    <Th align="right">Montant</Th>
                    <Th>Statut devis</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.aFacturerDetail.acomptes.length === 0 && data.aFacturerDetail.soldes.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>Rien à facturer.</td></tr>
                  )}
                  {data.aFacturerDetail.acomptes.map(d => (
                    <tr key={`acpt-${d.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <Td>{centreById.get(d.centreId)?.nom ?? '—'}</Td>
                      <Td>{d.demande?.titre ?? '—'}</Td>
                      <Td><Pill color="var(--color-warning)">Acompte</Pill></Td>
                      <Td align="right">{fmtEUR(d.montantAcompte ?? 0)}</Td>
                      <Td>{d.statut}</Td>
                    </tr>
                  ))}
                  {data.aFacturerDetail.soldes.map(d => (
                    <tr key={`solde-${d.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <Td>{centreById.get(d.centreId)?.nom ?? '—'}</Td>
                      <Td>{d.demande?.titre ?? '—'}</Td>
                      <Td><Pill color="var(--color-danger)">Solde</Pill></Td>
                      <Td align="right">{fmtEUR((d.montantTTC ?? 0) - (d.montantVerseTotal ?? 0))}</Td>
                      <Td>{d.statut}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Détail : Paiements en attente ───────────────────── */}
        <section ref={paiementsRef} id="paiements" className="mb-10 scroll-mt-6">
          <h2 className="text-lg" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Détail : Paiements en attente</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Factures émises dont le règlement n&apos;a pas encore été enregistré sur la plateforme. Pour enregistrer un paiement, accédez au détail du devis depuis le centre concerné.
          </p>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#FAFAF9', borderBottom: '1px solid #F3F4F6' }}>
                  <tr>
                    <Th>Centre</Th>
                    <Th>Référence</Th>
                    <Th>Séjour / Client</Th>
                    <Th align="right">Montant dû</Th>
                    <Th>Émission</Th>
                    <Th>Ancienneté</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.paiementsDetail.factures.length === 0 && data.paiementsDetail.devisLibres.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>Aucune facture en attente.</td></tr>
                  )}
                  {data.paiementsDetail.factures.map(f => {
                    const jours = f.dateFacture ? daysBetween(new Date(f.dateFacture), new Date()) : 0;
                    const ancienColor = jours > 30 ? 'var(--color-danger)' : jours > 15 ? 'var(--color-warning)' : 'var(--color-text-muted)';
                    return (
                      <tr key={`fac-${f.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <Td>{centreById.get(f.centreId)?.nom ?? '—'}</Td>
                        <Td>{f.numeroFacture ?? '—'}</Td>
                        <Td>{f.demande?.titre ?? '—'}</Td>
                        <Td align="right">{fmtEUR((f.montantTTC ?? 0) - f.montantVerseTotal)}</Td>
                        <Td>{f.dateFacture ? fmtDate(f.dateFacture) : '—'}</Td>
                        <Td><span style={{ color: ancienColor, fontWeight: jours > 15 ? 500 : 400 }}>{f.dateFacture ? `${jours} j` : '—'}</span></Td>
                      </tr>
                    );
                  })}
                  {data.paiementsDetail.devisLibres.map(dl => (
                    <tr key={`dl-${dl.id}`} className="hover:bg-gray-50" style={{ borderBottom: '1px solid #F3F4F6' }}>
                      <Td>{centreById.get(dl.centreId)?.nom ?? '—'}</Td>
                      <Td>{dl.numeroDevis ?? '—'}</Td>
                      <Td>{dl.client?.nom ?? '—'}</Td>
                      <Td align="right">{fmtEUR((dl.montantTTC ?? 0) - dl.montantVerseTotal)}</Td>
                      <Td>—</Td>
                      <Td>—</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Small components ───────────────────────────────────────────────────

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="px-4 py-2.5 text-xs uppercase tracking-wider"
      style={{ color: 'var(--color-text-muted)', fontWeight: 500, textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className="px-4 py-3 text-sm text-gray-900" style={{ textAlign: align }}>
      {children}
    </td>
  );
}

function Pill({ children, color, ml }: { children: React.ReactNode; color: string; ml?: boolean }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs"
      style={{
        marginLeft: ml ? 6 : 0,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        color,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
