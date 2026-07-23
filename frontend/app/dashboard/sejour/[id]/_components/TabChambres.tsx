'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/src/lib/api';
import type { SejourCollabInfo } from '@/src/lib/collaboration';

// ── Contrat grille — backend/src/chambres/occupations.controller.ts (4a) ─────
// X-Centre-Id posé explicitement (centre du séjour, pas le centre actif) —
// l'intercepteur de `api` ne l'écrase pas.

interface OccupationGrille {
  id: string;
  statut: 'OPTION' | 'FERME' | 'A_REPLACER';
  source: 'SEJOUR' | 'BLOCAGE';
  dateDebut: string;
  dateFin: string;
  etiquette?: string | null;
  couleur?: string | null;
  sejour: { id: string; titre: string } | null;
}

interface ChambreGrille {
  id: string;
  nom: string;
  etage: string | null;
  ordre: number;
  actif: boolean;
  capacite: number;
  etat: { type: 'libre' | 'option' | 'ferme' | 'bloquee' | 'a_replacer'; nbOptions?: number };
  occupations: OccupationGrille[];
}

interface GrilleResponse {
  debut: string;
  fin: string;
  chambres: ChambreGrille[];
}

// Contrat rooming-stats — backend/src/chambres/rooming.controller.ts (SC7)
interface RoomingStats {
  elevesTotal: number;
  filles: number;
  garcons: number;
  autre: number;
  aCategoriser: number;
  encadrants: number;
}

const BADGES: Record<ChambreGrille['etat']['type'], { label: string; cls: string }> = {
  libre: { label: 'Libre', cls: 'bg-green-100 text-green-700' },
  option: { label: 'Option', cls: 'bg-amber-100 text-amber-700' },
  ferme: { label: 'Occupée', cls: 'bg-blue-100 text-blue-700' },
  bloquee: { label: 'Bloquée', cls: 'bg-gray-100 text-gray-600' },
  a_replacer: { label: 'À replacer', cls: 'bg-red-100 text-red-700' },
};

// Directives hébergeur (SC7 lot 1). `couleur` en base = le TOKEN court, jamais
// la classe — le backend reste agnostique et le token resservira au PDF.
const ETIQUETTES = [
  { label: 'Filles', couleur: 'teal', cls: 'bg-teal-100 text-teal-700' },
  { label: 'Garçons', couleur: 'amber', cls: 'bg-amber-100 text-amber-700' },
  { label: 'Encadrants', couleur: 'violet', cls: 'bg-violet-100 text-violet-700' },
  { label: 'Mixte', couleur: 'slate', cls: 'bg-slate-100 text-slate-700' },
];

/** 403 PLAN_INSUFFICIENT : la modale globale (api.ts) s'en charge — rien de plus ici. */
function isPlanInsufficient(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { error?: string } } };
  return e?.response?.status === 403 && e?.response?.data?.error === 'PLAN_INSUFFICIENT';
}

export interface TabChambresProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  onError: (msg: string) => void;
}

export default function TabChambres({ sejourId, sejour, onError }: TabChambresProps) {
  const centreId = sejour.hebergementSelectionne?.id;
  const { dateDebut, dateFin } = sejour;

  const [grille, setGrille] = useState<GrilleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomingStats | null>(null);

  const loadGrille = useCallback(async () => {
    if (!centreId || !dateDebut || !dateFin) return;
    setLoading(true);
    try {
      const r = await api.get('/chambres/grille', {
        params: { debut: dateDebut.slice(0, 10), fin: dateFin.slice(0, 10) },
        headers: { 'X-Centre-Id': centreId },
      });
      setGrille(r.data);
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de charger la grille des chambres. Veuillez réessayer.');
      }
    } finally {
      setLoading(false);
    }
  }, [centreId, dateDebut, dateFin, onError]);

  useEffect(() => { loadGrille(); }, [loadGrille]);

  // Compteur participants (SC7) — indépendant des dates du séjour.
  useEffect(() => {
    if (!centreId) return;
    let annule = false;
    api
      .get('/chambres/rooming-stats', {
        params: { sejourId },
        headers: { 'X-Centre-Id': centreId },
      })
      .then((r) => { if (!annule) setStats(r.data); })
      .catch(() => {
        // 403 plan → modale globale ; autre erreur → compteur simplement
        // masqué, la grille reste prioritaire.
      });
    return () => { annule = true; };
  }, [centreId, sejourId]);

  // Occupation de CE séjour par chambre (source SEJOUR) — porte l'id pour le DELETE.
  const occupationDuSejour = useMemo(() => {
    const map = new Map<string, OccupationGrille>();
    for (const c of grille?.chambres ?? []) {
      const occ = c.occupations.find((o) => o.sejour?.id === sejourId && o.source === 'SEJOUR');
      if (occ) map.set(c.id, occ);
    }
    return map;
  }, [grille, sejourId]);

  const chambresAttribuees = useMemo(
    () => (grille?.chambres ?? []).filter((c) => occupationDuSejour.has(c.id)),
    [grille, occupationDuSejour],
  );
  const placesAttribuees = chambresAttribuees.reduce((s, c) => s + c.capacite, 0);

  const toggleSelection = (chambreId: string) => {
    setSelection((prev) =>
      prev.includes(chambreId) ? prev.filter((id) => id !== chambreId) : [...prev, chambreId],
    );
  };

  const handleAttribuer = async () => {
    if (selection.length === 0 || !centreId) return;
    setSaving(true);
    setAvertissement(null);
    try {
      // Dates omises → défaut backend = dates du séjour. D12 : jamais d'échec
      // sur conflit métier — les conflits reviennent dans `avertissements`.
      const r = await api.post(
        '/chambres/occupations',
        { sejourId, chambreIds: selection },
        { headers: { 'X-Centre-Id': centreId } },
      );
      const avertissements: { nom: string }[] = r.data?.avertissements ?? [];
      if (avertissements.length > 0) {
        setAvertissement(
          `${avertissements.length} chambre(s) attribuée(s) mais en conflit à résoudre : ${avertissements.map((a) => a.nom).join(', ')}`,
        );
      }
      setSelection([]);
      await loadGrille();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible d\'attribuer les chambres. Veuillez réessayer.');
      }
    } finally {
      setSaving(false);
    }
  };

  const setEtiquette = async (occupationId: string, label: string) => {
    const preset = ETIQUETTES.find((e) => e.label === label);
    try {
      // ⚠️ Marquage pur : etiquette + couleur SEULS — jamais de dates ni de
      // chambreId, sinon le backend bascule en mode déplacement (recalcul de
      // statut, 409 possible).
      await api.patch(
        `/chambres/occupations/${occupationId}`,
        preset
          ? { etiquette: preset.label, couleur: preset.couleur }
          : { etiquette: null, couleur: null },
        { headers: { 'X-Centre-Id': centreId } },
      );
      await loadGrille();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de modifier l\'étiquette. Veuillez réessayer.');
      }
    }
  };

  const handleRetirer = async (occupationId: string) => {
    try {
      await api.delete(`/chambres/occupations/${occupationId}`, {
        headers: { 'X-Centre-Id': centreId },
      });
      await loadGrille();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de retirer la chambre. Veuillez réessayer.');
      }
    }
  };

  // ── Garde-fous ──
  if (!centreId) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-6 py-4 text-sm text-red-700">
        Aucun centre associé à ce séjour — impossible d&apos;afficher les chambres.
      </div>
    );
  }

  const chambres = grille?.chambres ?? [];
  const sansDates = !dateDebut || !dateFin;

  return (
    <div className="space-y-4">
      {/* ── Compteur participants (SC7) — indépendant des dates du séjour ── */}
      {stats && (
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {stats.elevesTotal === 0 ? (
              <p className="text-sm text-gray-500">Aucun participant saisi pour l&apos;instant.</p>
            ) : (
              <p className="text-sm font-semibold text-gray-900">
                {stats.elevesTotal} participant(s) : {stats.filles} fille(s) · {stats.garcons} garçon(s) · {stats.autre} autre ·{' '}
                <span className={stats.aCategoriser > 0 ? 'rounded bg-amber-100 px-1.5 py-0.5 text-amber-700' : ''}>
                  {stats.aCategoriser} à catégoriser
                </span>
              </p>
            )}
            <p className="text-xs text-gray-500">
              {stats.encadrants} encadrant(s)
              {!sejour.inscriptionsCloturees && (
                <span className="text-gray-400"> · inscriptions en cours</span>
              )}
            </p>
          </div>
        </section>
      )}

      {avertissement && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3 text-sm text-amber-800">
          <span>{avertissement}</span>
          <button
            type="button"
            onClick={() => setAvertissement(null)}
            className="text-amber-500 hover:text-amber-700 shrink-0"
          >
            ×
          </button>
        </div>
      )}

      {/* ── Section chambres — conditionnelle aux dates, le compteur non ── */}
      {sansDates ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-sm text-gray-500">
          Définissez d&apos;abord les dates du séjour pour attribuer des chambres.
        </div>
      ) : loading && !grille ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : (
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {chambresAttribuees.length} chambre(s) attribuée(s) · {placesAttribuees} places
          </h3>
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          )}
        </div>

        {chambres.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            Aucune chambre dans le référentiel de ce centre.
          </p>
        ) : (
          <ul className="space-y-2">
            {chambres.map((c) => {
              const occ = occupationDuSejour.get(c.id);
              const badge = BADGES[c.etat.type];
              const badgeLabel =
                c.etat.type === 'option' && (c.etat.nbOptions ?? 0) > 1
                  ? `${badge.label} ×${c.etat.nbOptions}`
                  : badge.label;
              // Occupée/bloquée par un AUTRE séjour : titre en sous-texte, mais
              // la sélection reste possible (cohabitation d'options — D12, le
              // backend tranche, aucune logique de blocage ici).
              const titresOccupants = [
                ...new Set(
                  c.occupations
                    .filter((o) => o.statut === 'FERME' && o.sejour && o.sejour.id !== sejourId)
                    .map((o) => o.sejour!.titre),
                ),
              ];
              const selected = selection.includes(c.id);

              const infos = (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{c.nom}</span>
                    {c.etage && <span className="text-xs text-gray-400">{c.etage}</span>}
                    <span className="text-xs text-gray-500">{c.capacite} places</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.cls}`}>
                      {badgeLabel}
                    </span>
                  </div>
                  {titresOccupants.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      Occupée par {titresOccupants.join(', ')}
                    </p>
                  )}
                </div>
              );

              if (occ) {
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-3 py-2.5"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--color-primary)] bg-[var(--color-primary)]">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </span>
                    {infos}
                    {occ.etiquette && (
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          ETIQUETTES.find((e) => e.label === occ.etiquette)?.cls ?? 'bg-gray-200'
                        }`}
                      />
                    )}
                    <select
                      value={occ.etiquette ?? ''}
                      onChange={(e) => setEtiquette(occ.id, e.target.value)}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
                    >
                      <option value="">— étiquette</option>
                      {ETIQUETTES.map((e) => (
                        <option key={e.label} value={e.label}>
                          {e.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRetirer(occ.id)}
                      className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Retirer
                    </button>
                  </li>
                );
              }

              return (
                <li key={c.id}>
                  <label
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                      selected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelection(c.id)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        selected ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-gray-300'
                      }`}
                    >
                      {selected && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </span>
                    {infos}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {chambres.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleAttribuer}
              disabled={saving || selection.length === 0}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? 'Attribution…'
                : `Attribuer les chambres sélectionnées (${selection.length})`}
            </button>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
