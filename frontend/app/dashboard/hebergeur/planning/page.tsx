'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesSejoursConvention } from '@/src/lib/collaboration';
import type { SejourConventionHebergeur } from '@/src/lib/collaboration';
import { getDisponibilites, createDisponibilite, deleteDisponibilite } from '@/src/lib/centre';
import { getMesDevisLibres } from '@/src/lib/devis-libres';
import type { DevisLibre } from '@/src/lib/devis-libres';
import { useRouter, useSearchParams } from 'next/navigation';

// Palette 8 couleurs séjours
const PALETTE = [
  { bg: '#1B6CA8', text: '#fff' },
  { bg: '#2E8B57', text: '#fff' },
  { bg: '#C87D2E', text: '#fff' },
  { bg: '#7B3FA0', text: '#fff' },
  { bg: '#C0392B', text: '#fff' },
  { bg: '#16A085', text: '#fff' },
  { bg: '#D35400', text: '#fff' },
  { bg: '#2C3E50', text: '#fff' },
];

const COULEUR_DL: Record<string, { bg: string; text: string }> = {
  ENVOYE:  { bg: '#F59E0B', text: '#fff' },
  ACCEPTE: { bg: '#16A34A', text: '#fff' },
  PAYE:    { bg: '#1B4060', text: '#fff' },
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06h → 21h
const SLOT_HEIGHT = 60; // px par heure

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

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// CORRECT — date locale, sans conversion UTC qui décalait d'un jour
function dateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getViewDays(view: 'jour' | '5jours' | 'semaine', currentDate: Date): Date[] {
  if (view === 'jour') {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    return [d];
  }
  if (view === '5jours') {
    const monday = startOfWeek(currentDate);
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }
  const monday = startOfWeek(currentDate);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function HebergeurPlanningPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-16">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    }>
      <PlanningContent />
    </Suspense>
  );
}

function PlanningContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sejours, setSejours] = useState<SejourConventionHebergeur[]>([]);
  const [dispos, setDispos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'jour' | '5jours' | 'semaine' | 'mois'>(() => {
    const v = searchParams.get('view');
    if (v === 'jour' || v === '5jours' || v === 'semaine' || v === 'mois') return v;
    return 'semaine';
  });
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const d = searchParams.get('date');
    if (d && !isNaN(Date.parse(d))) return new Date(d + 'T12:00:00');
    return new Date();
  });
  const [filterSejourId, setFilterSejourId] = useState<string | null>(null);
  const [filterDevisLibreId, setFilterDevisLibreId] = useState<string | null>(null);
  const [showDispoModal, setShowDispoModal] = useState(false);
  const [dispoForm, setDispoForm] = useState({ dateDebut: '', dateFin: '', commentaire: '' });
  const [saving, setSaving] = useState(false);
  const [devisLibres, setDevisLibres] = useState<DevisLibre[]>([]);

  // Combobox recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Fermeture dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Persistance URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('date', dateStr(currentDate));
    router.replace(`/dashboard/hebergeur/planning?${params.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, currentDate]);

  const loadData = useCallback(async () => {
    try {
      const [s, d, dl] = await Promise.all([
        getMesSejoursConvention(),
        getDisponibilites(),
        getMesDevisLibres(),
      ]);
      setSejours(s);
      setDispos(d);
      setDevisLibres(dl.filter(dl => dl.statut !== 'BROUILLON' && dl.statut !== 'REFUSE'));
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') loadData();
  }, [user, loadData]);

  if (isLoading || !user) return null;

  // Couleurs par séjour
  const couleurBySejour = Object.fromEntries(
    sejours.map((s, i) => [s.id, PALETTE[i % PALETTE.length]])
  );

  const sejoursFiltres = filterSejourId
    ? sejours.filter(s => s.id === filterSejourId)
    : sejours;

  const devisLibresFiltres = filterDevisLibreId
    ? devisLibres.filter(dl => dl.id === filterDevisLibreId)
    : devisLibres;

  // Jours à afficher selon la vue
  const viewDays = view !== 'mois'
    ? getViewDays(view as 'jour' | '5jours' | 'semaine', currentDate)
    : [];

  // Navigation unifiée
  const prev = () => {
    if (view === 'jour') setCurrentDate(d => addDays(d, -1));
    else if (view === '5jours') setCurrentDate(d => addDays(d, -7));
    else if (view === 'semaine') setCurrentDate(d => addDays(d, -7));
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const next = () => {
    if (view === 'jour') setCurrentDate(d => addDays(d, 1));
    else if (view === '5jours') setCurrentDate(d => addDays(d, 7));
    else if (view === 'semaine') setCurrentDate(d => addDays(d, 7));
    else setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const handleCellClick = (dayStr: string) => {
    setDispoForm({ dateDebut: dayStr, dateFin: dayStr, commentaire: '' });
    setShowDispoModal(true);
  };

  const handleAddDispo = async () => {
    setSaving(true);
    try {
      await createDisponibilite({
        dateDebut: dispoForm.dateDebut,
        dateFin: dispoForm.dateFin,
        capaciteDisponible: 0,
        commentaire: dispoForm.commentaire || 'Indisponible',
      });
      await loadData();
      setShowDispoModal(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDispo = async (id: string) => {
    await deleteDisponibilite(id);
    setDispos(prev => prev.filter(d => d.id !== id));
  };

  // Activités d'un jour donné pour un séjour
  const activitesForDay = (sejourId: string, dayStr: string) => {
    const s = sejours.find(sj => sj.id === sejourId);
    if (!s) return [];
    return (s.planningActivites ?? []).filter(a => a.date.split('T')[0] === dayStr);
  };

  // Indispos d'un jour
  const disposForDay = (dayStr: string) => {
    return dispos.filter(d => {
      const start = d.dateDebut.split('T')[0];
      const end = d.dateFin.split('T')[0];
      return dayStr >= start && dayStr <= end;
    });
  };

  // Séjours actifs un jour donné
  const sejoursForDay = (dayStr: string) => {
    return sejoursFiltres.filter(s => {
      const start = s.dateDebut.split('T')[0];
      const end = s.dateFin.split('T')[0];
      return dayStr >= start && dayStr <= end;
    });
  };

  // Position px d'une activité
  const topPx = (hhmm: string) => {
    const mins = toMinutes(hhmm) - 6 * 60;
    return Math.max(0, (mins / 60) * SLOT_HEIGHT);
  };
  const heightPx = (debut: string, fin: string) => {
    const mins = toMinutes(fin) - toMinutes(debut);
    return Math.max(20, (mins / 60) * SLOT_HEIGHT);
  };

  const totalHeight = HOURS.length * SLOT_HEIGHT;

  // Recherche combobox
  const q = normalise(searchQuery.trim());
  const filteredSejours = q
    ? sejours.filter(s => {
        return normalise(s.titre).includes(q)
          || (s.createur && normalise(`${s.createur.prenom} ${s.createur.nom}`).includes(q));
      })
    : sejours;
  const filteredDevisLibres = q
    ? devisLibres.filter(dl => {
        return normalise(dl.nomClient).includes(q)
          || (dl.typeEvenement && normalise(dl.typeEvenement).includes(q));
      })
    : devisLibres;

  const selectSejour = (s: SejourConventionHebergeur) => {
    setFilterSejourId(s.id);
    setFilterDevisLibreId(null);
    setCurrentDate(new Date(s.dateDebut.split('T')[0] + 'T12:00:00'));
    setSearchQuery('');
    setShowDropdown(false);
  };
  const selectDevisLibre = (dl: DevisLibre) => {
    setFilterDevisLibreId(dl.id);
    setFilterSejourId(null);
    setCurrentDate(new Date(dl.dateDebut.split('T')[0] + 'T12:00:00'));
    setSearchQuery('');
    setShowDropdown(false);
  };
  const resetFilters = () => {
    setFilterSejourId(null);
    setFilterDevisLibreId(null);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const fmtRange = (debut: string, fin: string) => {
    const d1 = new Date(debut.split('T')[0] + 'T12:00:00');
    const d2 = new Date(fin.split('T')[0] + 'T12:00:00');
    const f = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${f(d1)} → ${f(d2)}`;
  };

  // Titre dynamique selon la vue
  const titreVue = (() => {
    if (view === 'mois') return fmtMonth(currentDate);
    if (view === 'jour') {
      return viewDays[0].toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    const d1 = viewDays[0];
    const d2 = viewDays[viewDays.length - 1];
    return `Semaine du ${d1.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${d2.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  })();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/hebergeur" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Tableau de bord</Link>
          <h1 className="text-base font-semibold text-gray-900">Planning</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Combobox recherche */}
          <div className="relative" ref={comboRef}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Rechercher un séjour ou un client..."
              className="w-72 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            {(filterSejourId || filterDevisLibreId) && (
              <button
                type="button"
                onClick={resetFilters}
                title="Réinitialiser le filtre"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
              >
                ×
              </button>
            )}
            {showDropdown && (
              <div className="absolute right-0 left-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg max-h-96 overflow-y-auto">
                <button
                  type="button"
                  onClick={resetFilters}
                  className={`w-full text-left px-3 py-2 text-xs border-b border-gray-100 hover:bg-gray-50 ${!filterSejourId && !filterDevisLibreId ? 'font-semibold text-[var(--color-primary)]' : 'text-gray-700'}`}
                >
                  Tous
                </button>
                {filteredSejours.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Séjours</p>
                    {filteredSejours.map(s => {
                      const c = couleurBySejour[s.id];
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectSejour(s)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c?.bg ?? '#999' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{s.titre}</p>
                            <p className="text-[10px] text-gray-400 truncate">
                              {s.createur ? `${s.createur.prenom} ${s.createur.nom} · ` : ''}{fmtRange(s.dateDebut, s.dateFin)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {filteredDevisLibres.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Événements</p>
                    {filteredDevisLibres.map(dl => {
                      const c = COULEUR_DL[dl.statut] ?? COULEUR_DL.ENVOYE;
                      return (
                        <button
                          key={dl.id}
                          type="button"
                          onClick={() => selectDevisLibre(dl)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c.bg }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{dl.typeEvenement ?? 'Événement'} · {dl.nomClient}</p>
                            <p className="text-[10px] text-gray-400 truncate">{fmtRange(dl.dateDebut, dl.dateFin)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {filteredSejours.length === 0 && filteredDevisLibres.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-400">Aucun résultat</p>
                )}
              </div>
            )}
          </div>
          {/* Vue */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['jour', '5jours', 'semaine', 'mois'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v === 'jour' ? 'Jour' : v === '5jours' ? '5 jours' : v === 'semaine' ? 'Semaine' : 'Mois'}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Aujourd&apos;hui</button>
            <button onClick={prev} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button onClick={next} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : view !== 'mois' ? (
          // ── VUES JOUR / 5 JOURS / SEMAINE ──
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header titre */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{titreVue}</h2>
            </div>

            {/* Bandeau all-day séjours */}
            <div className="flex border-b border-gray-200">
              <div className="w-14 shrink-0 border-r border-gray-100" />
              {viewDays.map((day, di) => {
                const ds = dateStr(day);
                const sj = sejoursForDay(ds);
                return (
                  <div key={di} className="flex-1 border-r border-gray-100 last:border-0 min-h-[28px]">
                    {sj.map(s => {
                      const c = couleurBySejour[s.id];
                      const isStart = s.dateDebut.split('T')[0] === ds;
                      const isEnd = s.dateFin.split('T')[0] === ds;
                      return (
                        <Link
                          key={s.id}
                          href={`/dashboard/sejour/${s.id}`}
                          onClick={e => e.stopPropagation()}
                          className="block text-xs px-1.5 py-0.5 truncate"
                          style={{
                            backgroundColor: c.bg,
                            color: c.text,
                            marginLeft: isStart ? 2 : 0,
                            marginRight: isEnd ? 2 : 0,
                            borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                          }}
                        >
                          {isStart ? s.titre : ''}
                        </Link>
                      );
                    })}
                    {devisLibresFiltres
                      .filter(dl => {
                        const s = dl.dateDebut.split('T')[0];
                        const e = dl.dateFin.split('T')[0];
                        return ds >= s && ds <= e;
                      })
                      .map(dl => {
                        const c = COULEUR_DL[dl.statut] ?? COULEUR_DL.ENVOYE;
                        const isStart = dl.dateDebut.split('T')[0] === ds;
                        return (
                          <div
                            key={dl.id}
                            className="block text-xs px-1.5 py-0.5 truncate cursor-pointer hover:opacity-90"
                            style={{
                              backgroundColor: c.bg,
                              color: c.text,
                              marginLeft: isStart ? 2 : 0,
                              borderRadius: isStart ? '4px 0 0 4px' : '0',
                            }}
                            onClick={() => router.push(`/dashboard/hebergeur/devis-libres/${dl.id}`)}
                            title={`${dl.typeEvenement ?? 'Événement'} — ${dl.nomClient}`}
                          >
                            {isStart ? `${dl.typeEvenement ?? 'Événement'} · ${dl.nomClient}` : ''}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* Header jours */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-14 shrink-0 border-r border-gray-100" />
              {viewDays.map((day, di) => {
                const isToday = dateStr(new Date()) === dateStr(day);
                return (
                  <div key={di} className={`flex-1 border-r border-gray-100 last:border-0 text-center py-2 ${isToday ? 'bg-blue-50' : ''}`}>
                    <p className={`text-xs font-medium ${isToday ? 'text-[var(--color-primary)]' : 'text-gray-500'}`}>
                      {day.toLocaleDateString('fr-FR', { weekday: 'short' }).toUpperCase()}
                    </p>
                    <p className={`text-sm font-bold ${isToday ? 'text-[var(--color-primary)]' : 'text-gray-900'}`}>
                      {day.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grille horaire */}
            <div className="flex overflow-y-auto" style={{ maxHeight: '70vh' }}>
              {/* Colonne heures */}
              <div className="w-14 shrink-0 border-r border-gray-100">
                {HOURS.map(h => (
                  <div key={h} style={{ height: SLOT_HEIGHT }} className="border-b border-gray-50 flex items-start justify-end pr-2 pt-1">
                    <span className="text-xs text-gray-400">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Colonnes jours */}
              {viewDays.map((day, di) => {
                const ds = dateStr(day);
                const isToday = dateStr(new Date()) === ds;
                const disposJour = disposForDay(ds);
                const sejoursJour = sejoursForDay(ds);

                return (
                  <div
                    key={di}
                    className={`flex-1 border-r border-gray-100 last:border-0 relative cursor-pointer ${isToday ? 'bg-blue-50/30' : ''}`}
                    style={{ height: totalHeight }}
                    onClick={() => handleCellClick(ds)}
                  >
                    {/* Lignes heures */}
                    {HOURS.map(h => (
                      <div key={h} style={{ height: SLOT_HEIGHT, top: (h - 6) * SLOT_HEIGHT }} className="absolute w-full border-b border-gray-100" />
                    ))}

                    {/* Indisponibilités */}
                    {disposJour.map(d => (
                      <div
                        key={d.id}
                        className="absolute inset-x-0 flex items-center justify-between px-1 z-10"
                        style={{ top: 0, height: totalHeight, background: 'repeating-linear-gradient(45deg, #fee2e2, #fee2e2 4px, #fef2f2 4px, #fef2f2 12px)' }}
                        onClick={e => { e.stopPropagation(); handleDeleteDispo(d.id); }}
                      >
                        <span className="text-xs text-red-600 font-medium bg-red-50 px-1 rounded">
                          {d.commentaire || 'Indisponible'} &times;
                        </span>
                      </div>
                    ))}

                    {/* Activités par séjour */}
                    {sejoursJour.map((s, sejourIdx) => {
                      const c = couleurBySejour[s.id];
                      const acts = activitesForDay(s.id, ds);
                      const total = sejoursJour.length;
                      const colWidth = 100 / total;
                      const colLeft = sejourIdx * colWidth;

                      return acts.map(a => (
                        <div
                          key={a.id}
                          className="absolute rounded px-1 py-0.5 overflow-hidden z-20 text-xs leading-tight cursor-pointer hover:opacity-90 transition-opacity"
                          title={`Accéder à l'espace collaboratif — ${s.titre}`}
                          style={{
                            top: topPx(a.heureDebut),
                            height: heightPx(a.heureDebut, a.heureFin),
                            left: `calc(${colLeft}% + 1px)`,
                            width: `calc(${colWidth}% - 2px)`,
                            backgroundColor: c.bg,
                            color: c.text,
                          }}
                          onClick={e => { e.stopPropagation(); router.push(`/dashboard/sejour/${s.id}`); }}
                        >
                          <p className="font-semibold truncate">{a.titre}</p>
                          <p className="opacity-80">{a.heureDebut} - {a.heureFin}</p>
                          {a.responsable && <p className="opacity-70 truncate">{a.responsable}</p>}
                        </div>
                      ));
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // ── VUE MOIS ──
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{titreVue}</h2>
            </div>
            {/* Jours de la semaine header */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 border-r border-gray-100 last:border-0">{d}</div>
              ))}
            </div>
            {/* Grille mois */}
            {(() => {
              const first = startOfMonth(currentDate);
              const firstDay = first.getDay() === 0 ? 6 : first.getDay() - 1;
              const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
              const cells: (Date | null)[] = [
                ...Array(firstDay).fill(null),
                ...Array.from({ length: daysInMonth }, (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)),
              ];
              while (cells.length % 7 !== 0) cells.push(null);
              const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
              return weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-0">
                  {week.map((day, di) => {
                    if (!day) return <div key={di} className="h-24 border-r border-gray-100 last:border-0 bg-gray-50" />;
                    const ds = dateStr(day);
                    const isToday = ds === dateStr(new Date());
                    const sj = sejoursForDay(ds);
                    const disposJour = disposForDay(ds);
                    return (
                      <div
                        key={di}
                        className={`h-24 border-r border-gray-100 last:border-0 p-1 overflow-hidden cursor-pointer hover:bg-gray-50 ${isToday ? 'bg-blue-50' : ''}`}
                        onClick={() => handleCellClick(ds)}
                      >
                        <p className={`text-xs font-medium mb-1 ${isToday ? 'text-[var(--color-primary)] font-bold' : 'text-gray-600'}`}>
                          {day.getDate()}
                        </p>
                        {disposJour.length > 0 && (
                          <div className="text-xs bg-red-100 text-red-600 rounded px-1 truncate mb-0.5">Indisponible</div>
                        )}
                        {sj.map(s => {
                          const c = couleurBySejour[s.id];
                          return (
                            <Link key={s.id} href={`/dashboard/sejour/${s.id}`} onClick={e => e.stopPropagation()} className="block text-xs px-1 rounded truncate mb-0.5" style={{ backgroundColor: c.bg, color: c.text }}>
                              {s.titre}
                            </Link>
                          );
                        })}
                        {devisLibresFiltres
                          .filter(dl => {
                            const s = dl.dateDebut.split('T')[0];
                            const e = dl.dateFin.split('T')[0];
                            return ds >= s && ds <= e;
                          })
                          .map(dl => {
                            const c = COULEUR_DL[dl.statut] ?? COULEUR_DL.ENVOYE;
                            return (
                              <div
                                key={dl.id}
                                className="block text-xs px-1 rounded truncate mb-0.5 cursor-pointer"
                                style={{ backgroundColor: c.bg, color: c.text }}
                                onClick={e => { e.stopPropagation(); router.push(`/dashboard/hebergeur/devis-libres/${dl.id}`); }}
                              >
                                {dl.typeEvenement ?? 'Événement'} · {dl.nomClient}
                              </div>
                            );
                          })}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
      </main>

      {/* Modale indisponibilité */}
      {showDispoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDispoModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Marquer comme indisponible</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
                <input type="date" value={dispoForm.dateDebut} onChange={e => setDispoForm(f => ({ ...f, dateDebut: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
                <input type="date" value={dispoForm.dateFin} onChange={e => setDispoForm(f => ({ ...f, dateFin: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Motif (optionnel)</label>
                <input type="text" value={dispoForm.commentaire} onChange={e => setDispoForm(f => ({ ...f, commentaire: e.target.value }))}
                  placeholder="ex: Maintenance, Fermeture..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowDispoModal(false);
                  router.push(
                    `/dashboard/hebergeur/devis-libres/nouveau?dateDebut=${dispoForm.dateDebut}&dateFin=${dispoForm.dateFin}`
                  );
                }}
                className="flex-1 rounded-lg bg-[#1B4060] py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                + Créer un événement
              </button>
              <button onClick={handleAddDispo} disabled={saving || !dispoForm.dateDebut || !dispoForm.dateFin}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {saving ? 'Enregistrement...' : 'Marquer indisponible'}
              </button>
              <button onClick={() => setShowDispoModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
