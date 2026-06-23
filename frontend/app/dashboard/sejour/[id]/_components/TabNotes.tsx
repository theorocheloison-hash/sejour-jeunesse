'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  updateNotesInternes,
  getActivitesSejour,
  createActiviteSejour,
  getRappelsSejour,
  createRappelSejour,
  type ActiviteSejour,
  type RappelSejour,
} from '@/src/lib/collaboration';

interface TabNotesProps {
  sejourId: string;
  initialNotes: string;
  onError: (message: string) => void;
}

// ── Types d'activité ──────────────────────────────────────────────────────────

const ACTIVITE_ICONS: Record<string, string> = {
  APPEL: '📞',
  EMAIL: '📧',
  VISITE: '👁',
  NOTE: '📝',
  DEVIS: '📄',
  FACTURE: '🧾',
  SIGNATURE: '✍️',
  VERSEMENT: '💰',
  BROCHURE: '📖',
};

// ── Metadata email (log d'envoi) ───────────────────────────────────────────────

interface EmailMetadata {
  emailType: string;
  to: string;
  subject?: string;
  messagePreview?: string;
}

function isEmailMetadata(m: unknown): m is EmailMetadata {
  return !!m && typeof m === 'object' && 'emailType' in m && 'to' in m;
}

const ACTIVITE_TYPES_MANUELS: { value: string; label: string }[] = [
  { value: 'APPEL', label: '📞 Appel' },
  { value: 'EMAIL', label: '📧 Email' },
  { value: 'VISITE', label: '👁 Visite' },
  { value: 'NOTE', label: '📝 Note' },
];

const RAPPEL_TYPES: { value: string; label: string }[] = [
  { value: 'APPEL', label: 'Appel' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'VISITE', label: 'Visite' },
  { value: 'RELANCE', label: 'Relance' },
  { value: 'AUTRE', label: 'Autre' },
];

// ── Helpers dates ─────────────────────────────────────────────────────────────

function formatDateRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Statut visuel d'un rappel selon sa date d'échéance et son statut. */
function rappelBadge(rappel: RappelSejour): { label: string; cls: string } {
  if (rappel.statut === 'FAIT') {
    return { label: '✓ Fait', cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' };
  }
  const echeance = startOfDay(new Date(rappel.dateEcheance));
  const today = startOfDay(new Date());
  if (echeance.getTime() < today.getTime()) {
    return { label: '🔴 En retard', cls: 'bg-red-100 text-red-700' };
  }
  if (echeance.getTime() === today.getTime()) {
    return { label: '🟡 Aujourd\'hui', cls: 'bg-amber-100 text-amber-700' };
  }
  return {
    label: echeance.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
    cls: 'bg-gray-100 text-gray-600',
  };
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function TabNotes({ sejourId, initialNotes, onError }: TabNotesProps) {
  // ── Section A : notes internes ──
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const saveNotes = useCallback(async (value: string) => {
    setSaving(true);
    try {
      await updateNotesInternes(sejourId, value);
      setSaving(false);
      setSavedAt(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedAt(false), 2000);
    } catch {
      setSaving(false);
      onError('Impossible d\'enregistrer les notes. Veuillez réessayer.');
    }
  }, [sejourId, onError]);

  // Debounce 1000ms sur la frappe
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { saveNotes(notes); }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [notes, saveNotes]);

  // Nettoyage des timers au démontage
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ── Section B : activités ──
  const [activites, setActivites] = useState<ActiviteSejour[]>([]);
  const [showActiviteForm, setShowActiviteForm] = useState(false);
  const [activiteForm, setActiviteForm] = useState({ type: 'NOTE', description: '' });
  const [activiteSending, setActiviteSending] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadActivites = useCallback(async () => {
    try {
      setActivites(await getActivitesSejour(sejourId));
    } catch { /* ignore */ }
  }, [sejourId]);

  // ── Section C : rappels ──
  const [rappels, setRappels] = useState<RappelSejour[]>([]);
  const [showRappelForm, setShowRappelForm] = useState(false);
  const [rappelForm, setRappelForm] = useState({ type: 'APPEL', dateRappel: '', description: '' });
  const [rappelSending, setRappelSending] = useState(false);

  const loadRappels = useCallback(async () => {
    try {
      setRappels(await getRappelsSejour(sejourId));
    } catch { /* ignore */ }
  }, [sejourId]);

  useEffect(() => {
    loadActivites();
    loadRappels();
  }, [loadActivites, loadRappels]);

  const handleAddActivite = async () => {
    if (!activiteForm.description.trim()) return;
    setActiviteSending(true);
    try {
      await createActiviteSejour(sejourId, {
        type: activiteForm.type,
        description: activiteForm.description.trim(),
      });
      setActiviteForm({ type: 'NOTE', description: '' });
      setShowActiviteForm(false);
      await loadActivites();
    } catch {
      onError('Impossible d\'ajouter l\'activité. Veuillez réessayer.');
    } finally {
      setActiviteSending(false);
    }
  };

  const handleAddRappel = async () => {
    if (!rappelForm.dateRappel || !rappelForm.description.trim()) return;
    setRappelSending(true);
    try {
      await createRappelSejour(sejourId, {
        type: rappelForm.type,
        dateRappel: rappelForm.dateRappel,
        description: rappelForm.description.trim(),
      });
      setRappelForm({ type: 'APPEL', dateRappel: '', description: '' });
      setShowRappelForm(false);
      await loadRappels();
    } catch {
      onError('Impossible de créer le rappel. Veuillez réessayer.');
    } finally {
      setRappelSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Section A : Notes internes ──────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <h3 className="text-sm font-semibold text-gray-900">Notes internes</h3>
            <span className="text-xs text-gray-400">Visible uniquement par vous</span>
          </div>
          <div className="text-xs text-gray-400 h-4">
            {saving ? (
              <span className="flex items-center gap-1">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                Enregistrement…
              </span>
            ) : savedAt ? (
              <span className="text-[var(--color-success)]">Sauvegardé ✓</span>
            ) : null}
          </div>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes internes (visibles uniquement par vous)..."
          className="w-full min-h-[120px] rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-y"
        />
      </section>

      {/* ── Section B : Timeline activités ──────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Activité du dossier</h3>
          {!showActiviteForm && (
            <button
              type="button"
              onClick={() => setShowActiviteForm(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              + Ajouter une note
            </button>
          )}
        </div>

        {showActiviteForm && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <select
              value={activiteForm.type}
              onChange={(e) => setActiviteForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            >
              {ACTIVITE_TYPES_MANUELS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <textarea
              value={activiteForm.description}
              onChange={(e) => setActiviteForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description…"
              className="w-full min-h-[70px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-y"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddActivite}
                disabled={activiteSending || !activiteForm.description.trim()}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                {activiteSending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => { setShowActiviteForm(false); setActiviteForm({ type: 'NOTE', description: '' }); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {activites.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Aucune activité enregistrée pour ce séjour.</p>
        ) : (
          <ul className="space-y-3">
            {activites.map((a) => {
              const emailMeta = isEmailMetadata(a.metadata) ? a.metadata : null;
              const isExpanded = expandedIds.has(a.id);

              return (
                <li key={a.id} className="flex items-start gap-3">
                  <span className="text-base leading-6 w-6 text-center shrink-0">
                    {ACTIVITE_ICONS[a.type] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={emailMeta ? 'cursor-pointer hover:text-[var(--color-primary)]' : ''}
                      onClick={() => emailMeta && toggleExpand(a.id)}
                    >
                      <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                        {a.description}
                        {emailMeta && (
                          <span className="ml-1 text-[10px] text-gray-400">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatDateRelative(a.createdAt)}
                      </p>
                    </div>
                    {emailMeta && isExpanded && (
                      <div className="mt-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs text-gray-600 space-y-1">
                        <p><span className="font-medium text-gray-700">À :</span> {emailMeta.to}</p>
                        {emailMeta.subject && (
                          <p><span className="font-medium text-gray-700">Objet :</span> {emailMeta.subject}</p>
                        )}
                        {emailMeta.messagePreview && (
                          <p><span className="font-medium text-gray-700">Message :</span> {emailMeta.messagePreview}</p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Section C : Rappels ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Rappels</h3>
          {!showRappelForm && (
            <button
              type="button"
              onClick={() => setShowRappelForm(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              + Nouveau rappel
            </button>
          )}
        </div>

        {showRappelForm && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex gap-3">
              <select
                value={rappelForm.type}
                onChange={(e) => setRappelForm((f) => ({ ...f, type: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              >
                {RAPPEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={rappelForm.dateRappel}
                onChange={(e) => setRappelForm((f) => ({ ...f, dateRappel: e.target.value }))}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
              />
            </div>
            <textarea
              value={rappelForm.description}
              onChange={(e) => setRappelForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description…"
              className="w-full min-h-[70px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] resize-y"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRappel}
                disabled={rappelSending || !rappelForm.dateRappel || !rappelForm.description.trim()}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
              >
                {rappelSending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
              <button
                type="button"
                onClick={() => { setShowRappelForm(false); setRappelForm({ type: 'APPEL', dateRappel: '', description: '' }); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {rappels.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">Aucun rappel pour ce séjour.</p>
        ) : (
          <ul className="space-y-2">
            {rappels.map((r) => {
              const badge = rappelBadge(r);
              return (
                <li key={r.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{r.type}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap break-words mt-1">{r.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
