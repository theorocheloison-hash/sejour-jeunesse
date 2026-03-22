'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesSejoursConvention } from '@/src/lib/collaboration';
import type { SejourConventionVenue } from '@/src/lib/collaboration';
import { getDisponibilites, createDisponibilite, deleteDisponibilite } from '@/src/lib/centre';

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

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function VenuePlanningPage() {
  const { user, isLoading } = useAuth();
  const [sejours, setSejours] = useState<SejourConventionVenue[]>([]);
  const [dispos, setDispos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'semaine' | 'mois'>('semaine');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterSejourId, setFilterSejourId] = useState<string | null>(null);
  const [showDispoModal, setShowDispoModal] = useState(false);
  const [dispoForm, setDispoForm] = useState({ dateDebut: '', dateFin: '', commentaire: '' });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([getMesSejoursConvention(), getDisponibilites()]);
      setSejours(s);
      setDispos(d);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'VENUE') loadData();
  }, [user, loadData]);

  if (isLoading || !user) return null;

  // Couleurs par séjour
  const couleurBySejour = Object.fromEntries(
    sejours.map((s, i) => [s.id, PALETTE[i % PALETTE.length]])
  );

  const sejoursFiltres = filterSejourId
    ? sejours.filter(s => s.id === filterSejourId)
    : sejours;

  // ── VUE SEMAINE ──
  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const prevWeek = () => setCurrentDate(d => addDays(d, -7));
  const nextWeek = () => setCurrentDate(d => addDays(d, 7));
  const prevMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
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

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/venue" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Tableau de bord</Link>
          <h1 className="text-base font-semibold text-gray-900">Planning</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtre séjours */}
          <select
            value={filterSejourId ?? ''}
            onChange={e => setFilterSejourId(e.target.value || null)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="">Tous les séjours</option>
            {sejours.map(s => (
              <option key={s.id} value={s.id}>{s.titre}</option>
            ))}
          </select>
          {/* Vue */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['semaine', 'mois'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === v ? 'bg-[var(--color-primary)] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">Aujourd&apos;hui</button>
            <button onClick={view === 'semaine' ? prevWeek : prevMonth} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
            </button>
            <button onClick={view === 'semaine' ? nextWeek : nextMonth} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Légende séjours */}
      {sejours.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-4 overflow-x-auto">
          {sejours.map(s => {
            const c = couleurBySejour[s.id];
            return (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.bg }} />
                <span className="text-xs text-gray-600">{s.titre}</span>
                <span className="text-xs text-gray-400">
                  {new Date(s.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} &rarr; {new Date(s.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <main className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : view === 'semaine' ? (
          // ── VUE SEMAINE ──
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header titre semaine */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Semaine du {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
            </div>

            {/* Bandeau all-day séjours */}
            <div className="flex border-b border-gray-200">
              <div className="w-14 shrink-0 border-r border-gray-100" />
              {weekDays.map((day, di) => {
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
                  </div>
                );
              })}
            </div>

            {/* Header jours */}
            <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="w-14 shrink-0 border-r border-gray-100" />
              {weekDays.map((day, di) => {
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
              {weekDays.map((day, di) => {
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
                          onClick={e => { e.stopPropagation(); window.location.href = `/dashboard/sejour/${s.id}`; }}
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
              <h2 className="text-sm font-semibold text-gray-900 capitalize">{fmtMonth(currentDate)}</h2>
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
