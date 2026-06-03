'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesSejoursPlanning, createSejourDirect } from '@/src/lib/collaboration';
import type { SejourPlanning } from '@/src/lib/collaboration';
import { PLANNING_COULEURS, derivePlanningStatut } from '@/src/lib/planning-statut';
import { getDisponibilites, createDisponibilite, deleteDisponibilite } from '@/src/lib/centre';
import { getMesClients } from '@/src/lib/clients';
import type { Client } from '@/src/lib/clients';
import api from '@/src/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

// Style de hachures diagonales appliqué aux statuts OPTION / INDISPONIBLE
const HACHURES_BG = `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.2) 4px, rgba(255,255,255,0.2) 8px)`;

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

  const [sejours, setSejours] = useState<SejourPlanning[]>([]);
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
  const [showDispoModal, setShowDispoModal] = useState(false);
  const [dispoForm, setDispoForm] = useState({ dateDebut: '', dateFin: '', commentaire: '' });
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'SEJOUR' | 'EVENEMENT'>('SEJOUR');

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
      const [s, d] = await Promise.all([
        getMesSejoursPlanning(),
        getDisponibilites(),
      ]);
      setSejours(s);
      setDispos(d);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') loadData();
  }, [user, loadData]);

  if (isLoading || !user) return null;

  // Couleurs par séjour — dérivées du statut (séjour + devis)
  const couleurBySejour = Object.fromEntries(
    sejours.map((s) => {
      const statut = derivePlanningStatut(s);
      return [s.id, PLANNING_COULEURS[statut]];
    })
  );

  const sejoursFiltres = filterSejourId
    ? sejours.filter(s => s.id === filterSejourId)
    : sejours;

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

  const handleAddDispoQuick = async () => {
    setSaving(true);
    try {
      await createDisponibilite({
        dateDebut: dispoForm.dateDebut,
        dateFin: dispoForm.dateFin,
        capaciteDisponible: 0,
        commentaire: 'Indisponible',
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

  // Recherche combobox : séparer séjours et événements
  const q = normalise(searchQuery.trim());
  const filteredSejoursList = q
    ? sejours.filter(s => s.natureSejour === 'SEJOUR').filter(s =>
        normalise(s.titre).includes(q) ||
        (s.createur && normalise(`${s.createur.prenom} ${s.createur.nom}`).includes(q)) ||
        (s.clientNom && normalise(s.clientNom).includes(q)) ||
        (s.clientOrganisation && normalise(s.clientOrganisation).includes(q))
      )
    : sejours.filter(s => s.natureSejour === 'SEJOUR');

  const filteredEvenements = q
    ? sejours.filter(s => s.natureSejour === 'EVENEMENT').filter(s =>
        normalise(s.titre).includes(q) ||
        (s.clientNom && normalise(s.clientNom).includes(q)) ||
        (s.clientOrganisation && normalise(s.clientOrganisation).includes(q))
      )
    : sejours.filter(s => s.natureSejour === 'EVENEMENT');

  const selectSejour = (s: SejourPlanning) => {
    setFilterSejourId(s.id);
    setCurrentDate(new Date(s.dateDebut.split('T')[0] + 'T12:00:00'));
    setSearchQuery('');
    setShowDropdown(false);
  };
  const resetFilters = () => {
    setFilterSejourId(null);
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
            {filterSejourId && (
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
                  className={`w-full text-left px-3 py-2 text-xs border-b border-gray-100 hover:bg-gray-50 ${!filterSejourId ? 'font-semibold text-[var(--color-primary)]' : 'text-gray-700'}`}
                >
                  Tous
                </button>
                {filteredSejoursList.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Séjours</p>
                    {filteredSejoursList.map(s => {
                      const c = couleurBySejour[s.id];
                      const sub = s.createur
                        ? `${s.createur.prenom} ${s.createur.nom}`
                        : s.clientOrganisation || s.clientNom || '';
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
                              {sub ? `${sub} · ` : ''}{fmtRange(s.dateDebut, s.dateFin)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {filteredEvenements.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-gray-400">Événements</p>
                    {filteredEvenements.map(s => {
                      const c = couleurBySejour[s.id];
                      const sub = s.clientOrganisation || s.clientNom || '';
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectSejour(s)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: c?.bg ?? '#999' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">{s.titre}{sub ? ` · ${sub}` : ''}</p>
                            <p className="text-[10px] text-gray-400 truncate">{fmtRange(s.dateDebut, s.dateFin)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
                {filteredSejoursList.length === 0 && filteredEvenements.length === 0 && (
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
                      const isOption = s.statut === 'OPTION';
                      const isEvenement = s.natureSejour === 'EVENEMENT';
                      return (
                        <Link
                          key={s.id}
                          href={`/dashboard/sejour/${s.id}`}
                          onClick={e => e.stopPropagation()}
                          className="block text-xs px-1.5 py-0.5 truncate"
                          style={{
                            backgroundColor: c?.bg ?? '#6B7280',
                            color: c?.text ?? '#fff',
                            ...(c?.hachures && { backgroundImage: HACHURES_BG }),
                            marginLeft: isStart ? 2 : 0,
                            marginRight: isEnd ? 2 : 0,
                            borderRadius: isStart ? '4px 0 0 4px' : isEnd ? '0 4px 4px 0' : '0',
                          }}
                        >
                          {isStart ? `${isOption ? '⏳ ' : ''}${isEvenement ? '🎉 ' : ''}${s.titre}` : ''}
                        </Link>
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
                        style={{
                          top: 0,
                          height: totalHeight,
                          backgroundColor: `${PLANNING_COULEURS.INDISPONIBLE.bg}26`,
                          backgroundImage: HACHURES_BG,
                        }}
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
                            backgroundColor: c?.bg ?? '#6B7280',
                            color: c?.text ?? '#fff',
                            ...(c?.hachures && { backgroundImage: HACHURES_BG }),
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
                          <div
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
                          const c = couleurBySejour[s.id];
                          const isOption = s.statut === 'OPTION';
                          const isEvenement = s.natureSejour === 'EVENEMENT';
                          return (
                            <Link
                              key={s.id}
                              href={`/dashboard/sejour/${s.id}`}
                              onClick={e => e.stopPropagation()}
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
              ));
            })()}
          </div>
        )}
      </main>

      {/* Légende */}
      {!loading && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
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
                {key === 'OPTION' ? 'Option' :
                 key === 'CONFIRME' ? 'Confirmé' :
                 key === 'ACOMPTE_VERSE' ? 'Acompte versé' :
                 key === 'SOLDE' ? 'Soldé' :
                 'Indisponible'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Modale choix action planning */}
      {showDispoModal && !showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDispoModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {dispoForm.dateDebut ? new Date(dispoForm.dateDebut + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
            </h2>
            <p className="text-xs text-gray-400 mb-5">Que souhaitez-vous faire ?</p>

            <div className="space-y-3">
              <button
                onClick={() => { setCreateType('SEJOUR'); setShowCreateModal(true); }}
                className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-[var(--color-primary)] hover:bg-blue-50/50 transition-colors"
              >
                <span className="text-2xl">🏫</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Nouveau séjour</p>
                  <p className="text-xs text-gray-400">Classe de découverte, colonie, camp sportif…</p>
                </div>
              </button>

              <button
                onClick={() => { setCreateType('EVENEMENT'); setShowCreateModal(true); }}
                className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-[#7B3FA0] hover:bg-purple-50/50 transition-colors"
              >
                <span className="text-2xl">🎉</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Nouvel événement</p>
                  <p className="text-xs text-gray-400">Mariage, séminaire, anniversaire, team building…</p>
                </div>
              </button>

              <button
                onClick={handleAddDispoQuick}
                disabled={saving}
                className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-4 text-left hover:border-red-400 hover:bg-red-50/50 transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">🚫</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Marquer indisponible</p>
                  <p className="text-xs text-gray-400">Maintenance, fermeture, réservé…</p>
                </div>
              </button>
            </div>

            <button onClick={() => setShowDispoModal(false)} className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale création séjour / événement DIRECT */}
      {showCreateModal && (
        <CreateSejourDirectModal
          natureSejour={createType}
          dateDebut={dispoForm.dateDebut}
          dateFin={dispoForm.dateFin}
          onClose={() => { setShowCreateModal(false); setShowDispoModal(false); }}
          onCreated={(sejour) => {
            setShowCreateModal(false);
            setShowDispoModal(false);
            loadData();
            router.push(`/dashboard/sejour/${sejour.id}`);
          }}
        />
      )}
    </div>
  );
}

// ─── CreateSejourDirectModal ──────────────────────────────────────────────

const SOUS_TYPES_SEJOUR = [
  { value: 'CLASSE_DECOUVERTE', label: 'Classe de découverte' },
  { value: 'COLONIE_VACANCES', label: 'Colonie de vacances' },
  { value: 'CAMP_SPORTIF', label: 'Camp sportif' },
  { value: 'SEJOUR_LINGUISTIQUE', label: 'Séjour linguistique' },
  { value: 'AUTRE_SEJOUR', label: 'Autre séjour' },
];

const SOUS_TYPES_EVENEMENT = [
  { value: 'MARIAGE', label: 'Mariage' },
  { value: 'ANNIVERSAIRE', label: 'Anniversaire' },
  { value: 'SEMINAIRE', label: 'Séminaire' },
  { value: 'TEAM_BUILDING', label: 'Team building' },
  { value: 'REUNION_FAMILLE', label: 'Réunion de famille' },
  { value: 'AUTRE_EVENEMENT', label: 'Autre événement' },
];

interface StructResult {
  nom: string;
  adresse: string | null;
  ville: string | null;
  siren: string | null;
  siret: string | null;
  source: string;
}

function CreateSejourDirectModal({ natureSejour, dateDebut, dateFin, onClose, onCreated }: {
  natureSejour: 'SEJOUR' | 'EVENEMENT';
  dateDebut: string;
  dateFin: string;
  onClose: () => void;
  onCreated: (sejour: SejourPlanning) => void;
}) {
  const [form, setForm] = useState({
    titre: '',
    typeSejour: natureSejour === 'SEJOUR' ? 'CLASSE_DECOUVERTE' : 'MARIAGE',
    dateDebut,
    dateFin,
    nombreParticipants: '',
    clientNom: '',
    clientPrenom: '',
    clientEmail: '',
    clientTelephone: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bug 2 — type de client : Particulier (mariage, anniversaire…) ou Professionnel (SIRET)
  const [clientType, setClientType] = useState<'PARTICULIER' | 'PROFESSIONNEL'>(
    natureSejour === 'EVENEMENT' ? 'PARTICULIER' : 'PROFESSIONNEL'
  );

  // Bug 3 — autocomplétion du contact depuis les clients existants du CRM
  const [crmClients, setCrmClients] = useState<Client[]>([]);
  const [showContactSuggest, setShowContactSuggest] = useState(false);

  const [structNom, setStructNom] = useState('');
  const [structVille, setStructVille] = useState('');
  const [structCodePostal, setStructCodePostal] = useState('');
  const [structResults, setStructResults] = useState<StructResult[]>([]);
  const [structSearching, setStructSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{ nom: string; adresse: string | null; ville: string | null } | null>(null);
  const structDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const structAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
      if (structAbortRef.current) structAbortRef.current.abort();
    };
  }, []);

  // Bug 3 — charger les clients du CRM pour l'autocomplétion du contact
  useEffect(() => {
    getMesClients().then(setCrmClients).catch(() => {});
  }, []);

  const fireStructSearch = (nom: string, ville: string, cp: string) => {
    if (structDebounceRef.current) clearTimeout(structDebounceRef.current);
    const q = [nom.trim(), cp.trim(), ville.trim()].filter(Boolean).join(' ');
    if (q.length < 2) { setStructResults([]); return; }

    structDebounceRef.current = setTimeout(async () => {
      if (structAbortRef.current) structAbortRef.current.abort();
      const controller = new AbortController();
      structAbortRef.current = controller;
      setStructSearching(true);
      try {
        const res = await api.get('/organisations/search', { params: { q }, signal: controller.signal });
        setStructResults(res.data?.results ?? []);
      } catch { /* aborted */ }
      finally { if (!controller.signal.aborted) setStructSearching(false); }
    }, 300);
  };

  const selectStruct = (r: StructResult) => {
    setSelectedOrg({ nom: r.nom, adresse: r.adresse, ville: r.ville });
    setStructResults([]);
    setStructNom(r.nom);
    setStructVille(r.ville ?? '');
  };

  const clearStruct = () => {
    setSelectedOrg(null);
    setStructNom('');
    setStructVille('');
    setStructCodePostal('');
    setStructResults([]);
  };

  // Bug 3 — suggestions de contacts existants (CRM) filtrées sur le nom saisi
  const contactSuggestions = (() => {
    const q = normalise(form.clientNom.trim());
    if (q.length < 2) return [];
    const seen = new Set<string>();
    const out: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }[] = [];
    const push = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
      const key = `${normalise(s.prenom)}|${normalise(s.nom)}|${s.email.toLowerCase()}`;
      if (!s.nom && !s.prenom) return;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };
    for (const c of crmClients) {
      const isParticulier = c.type === 'PARTICULIER';
      const organisation = isParticulier ? null : c.nom;
      // Un particulier est souvent stocké en tant que Client (nom = nom de famille)
      if (isParticulier) {
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: null });
      }
      // Tout client (quelle que soit son organisation) : indexer le nom du client lui-même
      if (!isParticulier) {
        // Chercher sur clientNom : le nom de l'organisation / famille / couple
        push({ prenom: '', nom: c.nom, email: c.email ?? '', telephone: c.telephone ?? '', organisation: c.nom });
      }
      for (const ct of c.contacts ?? []) {
        push({ prenom: ct.prenom ?? '', nom: ct.nom ?? '', email: ct.email ?? '', telephone: ct.telephone ?? '', organisation });
      }
    }
    return out
      .filter(s => normalise(`${s.prenom} ${s.nom}`).includes(q) || normalise(s.nom).includes(q))
      .slice(0, 8);
  })();

  const selectContact = (s: { prenom: string; nom: string; email: string; telephone: string; organisation: string | null }) => {
    setForm(f => ({
      ...f,
      clientNom: s.nom,
      clientPrenom: s.prenom || f.clientPrenom,
      clientEmail: s.email || f.clientEmail,
      clientTelephone: s.telephone || f.clientTelephone,
    }));
    // Contact rattaché à une structure → bascule en mode Professionnel et pré-sélectionne l'organisation
    if (s.organisation) {
      setClientType('PROFESSIONNEL');
      setSelectedOrg({ nom: s.organisation, adresse: null, ville: null });
    }
    setShowContactSuggest(false);
  };

  const sousTypes = natureSejour === 'SEJOUR' ? SOUS_TYPES_SEJOUR : SOUS_TYPES_EVENEMENT;
  const labelParticipants = natureSejour === 'SEJOUR' ? 'Nombre de participants' : 'Nombre de personnes';
  const labelContact = natureSejour === 'SEJOUR' ? 'Structure organisatrice' : 'Client';

  const handleSubmit = async () => {
    if (!form.titre.trim()) { setError('Le titre est obligatoire'); return; }
    if (!form.dateDebut || !form.dateFin) { setError('Les dates sont obligatoires'); return; }

    setSaving(true);
    setError(null);
    try {
      const sejour = await createSejourDirect({
        titre: form.titre.trim(),
        natureSejour,
        typeSejour: form.typeSejour,
        dateDebut: form.dateDebut,
        dateFin: form.dateFin,
        nombreParticipants: parseInt(form.nombreParticipants) || 0,
        clientNom: form.clientNom.trim() || undefined,
        clientPrenom: form.clientPrenom.trim() || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientTelephone: form.clientTelephone.trim() || undefined,
        clientOrganisation: selectedOrg?.nom || undefined,
      });
      onCreated(sejour);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          {natureSejour === 'SEJOUR' ? '📋 Nouveau séjour' : '🎉 Nouvel événement'}
        </h2>
        <p className="text-xs text-gray-400 mb-5">Les dates seront bloquées au planning dès la création.</p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={form.typeSejour} onChange={set('typeSejour')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
              {sousTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" value={form.titre} onChange={set('titre')}
              placeholder={natureSejour === 'SEJOUR' ? 'ex: Classe de neige 4ème' : 'ex: Mariage Dupont-Martin'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date début</label>
              <input type="date" value={form.dateDebut} onChange={set('dateDebut')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date fin</label>
              <input type="date" value={form.dateFin} onChange={set('dateFin')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">{labelParticipants}</label>
            <input type="number" min="0" value={form.nombreParticipants} onChange={set('nombreParticipants')}
              placeholder="ex: 48"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">{labelContact}</p>
            {/* Bug 2 — choix explicite Particulier / Professionnel */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => { setClientType('PARTICULIER'); clearStruct(); }}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PARTICULIER' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                👤 Particulier
              </button>
              <button
                type="button"
                onClick={() => setClientType('PROFESSIONNEL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${clientType === 'PROFESSIONNEL' ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >
                🏢 Professionnel (SIRET)
              </button>
            </div>
          </div>

          {clientType === 'PROFESSIONNEL' && (!selectedOrg ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Renseignez les 3 champs pour trouver plus facilement la structure.</p>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={structNom} placeholder="Nom"
                  onChange={e => { setStructNom(e.target.value); fireStructSearch(e.target.value, structVille, structCodePostal); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={structCodePostal} placeholder="Code postal"
                  onChange={e => { setStructCodePostal(e.target.value); fireStructSearch(structNom, structVille, e.target.value); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={structVille} placeholder="Ville"
                  onChange={e => { setStructVille(e.target.value); fireStructSearch(structNom, e.target.value, structCodePostal); }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              {structSearching && <p className="text-xs text-gray-400">Recherche en cours…</p>}
              {structResults.length > 0 && (
                <div className="rounded-lg border border-gray-200 max-h-40 overflow-y-auto">
                  {structResults.map((r, i) => (
                    <button key={i} type="button" onClick={() => selectStruct(r)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-900">{r.nom}</span>
                      {r.ville && <span className="text-gray-400"> — {r.ville}</span>}
                      <span className="text-gray-300 ml-1">({r.source === 'API_SIRENE' ? 'SIRENE' : r.source})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedOrg.nom}</p>
                {selectedOrg.ville && <p className="text-xs text-gray-400">{selectedOrg.adresse ? `${selectedOrg.adresse}, ` : ''}{selectedOrg.ville}</p>}
              </div>
              <button type="button" onClick={clearStruct} className="text-xs text-red-500 hover:underline">Changer</button>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom du contact</label>
              <input
                type="text"
                autoComplete="off"
                value={form.clientNom}
                onChange={e => { setForm(f => ({ ...f, clientNom: e.target.value })); setShowContactSuggest(true); }}
                onFocus={() => setShowContactSuggest(true)}
                onBlur={() => setTimeout(() => setShowContactSuggest(false), 150)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              {/* Bug 3 — suggestions de clients existants du CRM */}
              {showContactSuggest && contactSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                  {contactSuggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => selectContact(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-900">{`${s.prenom} ${s.nom}`.trim()}</span>
                      {s.organisation && <span className="text-gray-400"> — {s.organisation}</span>}
                      {s.email && <span className="block text-[11px] text-gray-400">{s.email}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.clientPrenom} onChange={set('clientPrenom')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.clientEmail} onChange={set('clientEmail')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
              <input type="tel" value={form.clientTelephone} onChange={set('clientTelephone')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={saving || !form.titre.trim()}
            className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Création…' : natureSejour === 'SEJOUR' ? 'Créer le séjour' : 'Créer l\'événement'}
          </button>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
