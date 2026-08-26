'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/src/lib/api';
import { affecterChambre, getRoomingCollab, retirerChambre, type RoomingData, type SejourCollabInfo } from '@/src/lib/collaboration';
import { ETIQUETTES, groupByEtage } from '@/src/lib/rooming';
import RoomingEditor from './RoomingEditor';
import RoomingPlanView from './RoomingPlanView';
import RoomingPlanPDFButton from '@/src/components/pdf/RoomingPlanPDFButton';

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
  nbAffectations: number;
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

/** 403 PLAN_INSUFFICIENT : la modale globale (api.ts) s'en charge — rien de plus ici. */
function isPlanInsufficient(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { error?: string } } };
  return e?.response?.status === 403 && e?.response?.data?.error === 'PLAN_INSUFFICIENT';
}

export interface TabChambresProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  onError: (msg: string) => void;
  /** DIRECT géré en propre : layout répartition (éditeur) + attribution dépliable. */
  peutGererEnPropre?: boolean;
  /** Mode ATTRIBUTION éditable : HEBERGEUR + sejours:WRITE (true aussi en peutGererEnPropre). */
  peutEcrire: boolean;
}

export default function TabChambres({ sejourId, sejour, onError, peutGererEnPropre = false, peutEcrire }: TabChambresProps) {
  const centreId = sejour.hebergementSelectionne?.id;
  const { dateDebut, dateFin } = sejour;

  const [grille, setGrille] = useState<GrilleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [avertissement, setAvertissement] = useState<string | null>(null);
  const [stats, setStats] = useState<RoomingStats | null>(null);
  const [vue, setVue] = useState<'attribution' | 'plan'>('attribution');
  const [rooming, setRooming] = useState<RoomingData | null>(null);
  const [roomingErreur, setRoomingErreur] = useState(false);
  const [attributionOuverte, setAttributionOuverte] = useState(false);

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

  // Plan « qui dort où » (lecture seule — route ouverte à l'hébergeur, sans
  // X-Centre-Id, le controller l'ignore). Échec confiné à roomingErreur : ne
  // bloque JAMAIS la grille/l'attribution.
  const loadRooming = useCallback(async () => {
    try {
      setRoomingErreur(false);
      setRooming(await getRoomingCollab(sejourId));
    } catch {
      // Échec réel (le rooming est soft sur le plan → pas de 403 attendu ici).
      // On le signale en mode Plan au lieu d'afficher un faux « vide ».
      setRoomingErreur(true);
    }
  }, [sejourId]);

  useEffect(() => { loadRooming(); }, [loadRooming]);

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

  // Phase 3 : regroupement présentationnel de la sélection par étage (ordre
  // physique via min(ordre), aligné mode Plan / border #1). Le geste ne change
  // pas : selection reste un id[] à plat.
  const groupesChambres = useMemo(() => groupByEtage(grille?.chambres ?? []), [grille]);

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
      await loadRooming();
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

  const handleRetirer = async (occupationId: string, nbAffectations: number) => {
    // La cascade FK désaffecte les participants roomés — confirmation quand il
    // y en a, retrait direct sinon.
    if (
      nbAffectations > 0 &&
      !window.confirm(
        `Retirer cette chambre ? ${nbAffectations} participant(s) y sont affecté(s) et seront désaffecté(s).`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/chambres/occupations/${occupationId}`, {
        headers: { 'X-Centre-Id': centreId },
      });
      await loadGrille();
      await loadRooming();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de retirer la chambre. Veuillez réessayer.');
      }
    }
  };

  // ── Rooming en propre (DIRECT) — calqués sur TabRooming ; loadRooming PUIS
  // loadGrille : la grille porte nbAffectations, lu par la confirmation du
  // Retirer (sinon compte périmé → désaffectation silencieuse en cascade).
  const handleAffecterParticipant = async (chambreId: string, body: { autorisationId?: string; accompagnateurId?: string }) => {
    try {
      await affecterChambre(sejourId, chambreId, body);
      await loadRooming();
      await loadGrille();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        // Capacité dure (D7) : le back tranche — remonter son 409 parlant.
        const e = err as { response?: { data?: { message?: string } } };
        onError(e.response?.data?.message ?? 'Impossible d\'affecter le participant. Veuillez réessayer.');
      }
    }
  };

  const handleRetirerAffectation = async (affectationId: string) => {
    try {
      await retirerChambre(affectationId);
      await loadRooming();
      await loadGrille();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de retirer le participant. Veuillez réessayer.');
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

  // Bloc d'attribution (récap + dimensionnement + liste groupée + bouton) —
  // fonction de rendu interne : closures captées telles quelles. Servie par les
  // deux layouts (COLLAB : branche Attribution du toggle ; propre : dépliable).
  function renderAttribution() {
    return (
          <>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {chambresAttribuees.length} chambre(s) attribuée(s) · {placesAttribuees} places
            </h3>
            {/* Rapprochement places/personnes — le ⚠️ n'a de sens que si des
                chambres SONT attribuées (0 chambre = état initial normal). */}
            {stats && (() => {
              const totalPersonnes = stats.elevesTotal + stats.encadrants;
              if (placesAttribuees === 0) {
                return (
                  <p className="text-xs mt-0.5 text-gray-400">
                    {totalPersonnes} personne(s) à loger
                  </p>
                );
              }
              return placesAttribuees >= totalPersonnes ? (
                <p className="text-xs mt-0.5 text-green-600">
                  ✓ {placesAttribuees} place(s) pour {totalPersonnes} personne(s)
                </p>
              ) : (
                <p className="text-xs mt-0.5 text-amber-600">
                  ⚠️ {placesAttribuees} place(s) pour {totalPersonnes} personne(s) — il manque des places
                </p>
              );
            })()}
          </div>
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          )}
        </div>

        {chambres.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            Aucune chambre dans le référentiel de ce centre.
          </p>
        ) : (
          <div className="space-y-6">
            {groupesChambres.map((g, gi) => (
              <div key={g.etage ?? `sans-etage-${gi}`}>
                {(g.etage !== null || groupesChambres.length > 1) && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {g.etage ?? 'Autres'}
                  </h3>
                )}
                <ul className="space-y-2">
                  {g.chambres.map((c) => {
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
                    {peutEcrire ? (
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
                    ) : (
                      <span className="shrink-0 text-xs text-gray-500">{occ.etiquette ?? '—'}</span>
                    )}
                    {peutEcrire && (
                      <button
                        type="button"
                        onClick={() => handleRetirer(occ.id, occ.nbAffectations ?? 0)}
                        className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Retirer
                      </button>
                    )}
                  </li>
                );
              }

              return (
                <li key={c.id}>
                  {peutEcrire ? (
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
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                      {infos}
                    </div>
                  )}
                </li>
              );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {chambres.length > 0 && peutEcrire && (
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
          </>
    );
  }

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
        {peutGererEnPropre ? (
          <>
            {/* Gestion en propre (DIRECT) : la répartition groupée par étage EST
                le plan — pas de toggle Attribution/Plan, attribution dépliable
                en sibling conditionnel (RoomingEditor jamais démonté). */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <button
                type="button"
                onClick={() => setAttributionOuverte((v) => !v)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {attributionOuverte ? '▾ Gérer les chambres' : '▸ Gérer les chambres'}
              </button>
              {rooming && (
                <RoomingPlanPDFButton
                  planProps={{
                    titreSejour: sejour.titre,
                    dateDebut: sejour.dateDebut,
                    dateFin: sejour.dateFin,
                    centreName: sejour.hebergementSelectionne?.nom,
                    rooming,
                  }}
                  filename={`plan-chambres-${sejour.titre}.pdf`}
                />
              )}
            </div>

            {attributionOuverte && <div className="mb-6">{renderAttribution()}</div>}

            {roomingErreur ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                <span>Impossible de charger le plan des chambres.</span>
                <button
                  type="button"
                  onClick={loadRooming}
                  className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Réessayer
                </button>
              </div>
            ) : rooming == null ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            ) : rooming.chambres.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
                <p className="text-sm text-gray-400">Commencez par choisir vos chambres pour ce séjour.</p>
                <button
                  type="button"
                  onClick={() => setAttributionOuverte(true)}
                  className="mt-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors"
                >
                  Gérer les chambres
                </button>
              </div>
            ) : (
              <RoomingEditor
                rooming={rooming}
                groupParEtage
                onAffecter={handleAffecterParticipant}
                onRetirer={handleRetirerAffectation}
              />
            )}
          </>
        ) : (
          <>
        {/* Toggle Attribution | Plan + PDF — le plan est en lecture seule,
            le geste d'attribution reste intact en dessous */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['attribution', 'plan'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setVue(v); if (v === 'plan') loadRooming(); }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  vue === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'attribution' ? 'Attribution' : 'Plan'}
              </button>
            ))}
          </div>
          {rooming && (
            <RoomingPlanPDFButton
              planProps={{
                titreSejour: sejour.titre,
                dateDebut: sejour.dateDebut,
                dateFin: sejour.dateFin,
                centreName: sejour.hebergementSelectionne?.nom,
                rooming,
              }}
              filename={`plan-chambres-${sejour.titre}.pdf`}
            />
          )}
        </div>

        {vue === 'attribution' ? (
          renderAttribution()
        ) : roomingErreur ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Impossible de charger le plan des chambres.</span>
            <button
              type="button"
              onClick={loadRooming}
              className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <RoomingPlanView
            rooming={rooming ?? { chambres: [], nonAffectes: { eleves: [], encadrants: [] } }}
          />
        )}
          </>
        )}
      </section>
      )}
    </div>
  );
}
