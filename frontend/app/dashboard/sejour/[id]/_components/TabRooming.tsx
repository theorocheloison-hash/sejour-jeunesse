'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getRoomingCollab,
  affecterChambre,
  retirerChambre,
  cloturerInscriptions,
  type RoomingData,
  type RoomingParticipant,
  type SejourCollabInfo,
} from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import { ETIQUETTES } from './TabChambres';

// Vue ORGANISATEUR de l'onglet Chambres (SC7 lot 3) — drag & drop des
// participants vers les chambres attribuées par l'hébergeur. Calqué sur
// TabGroupes. ⚠️ Routes ORGANISATEUR : aucun header X-Centre-Id.

export interface TabRoomingProps {
  sejourId: string;
  sejour: SejourCollabInfo | null;
  user: User;
  onError: (message: string) => void;
  onSejourUpdate: (updates: Partial<SejourCollabInfo>) => void;
  onReloadSejour: () => void;
}

/** 403 PLAN_INSUFFICIENT : la modale globale (api.ts) s'en charge — rien ici. */
function isPlanInsufficient(err: unknown): boolean {
  const e = err as { response?: { status?: number; data?: { error?: string } } };
  return e?.response?.status === 403 && e?.response?.data?.error === 'PLAN_INSUFFICIENT';
}

export default function TabRooming({
  sejourId,
  sejour,
  user,
  onError,
  onSejourUpdate,
  onReloadSejour,
}: TabRoomingProps) {
  const [rooming, setRooming] = useState<RoomingData | null>(null);
  const [loading, setLoading] = useState(true);
  // ⚠️ Pas un simple id : au drop il faut savoir poster autorisationId (ELEVE)
  // ou accompagnateurId (ENCADRANT).
  const [drag, setDrag] = useState<{ id: string; type: 'ELEVE' | 'ENCADRANT' } | null>(null);

  const load = useCallback(async () => {
    try {
      setRooming(await getRoomingCollab(sejourId));
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de charger la répartition des chambres.');
      }
    } finally {
      setLoading(false);
    }
  }, [sejourId, onError]);

  useEffect(() => { load(); }, [load]);

  const handleCloturer = async () => {
    try {
      await cloturerInscriptions(sejourId);
      onSejourUpdate({ inscriptionsCloturees: true });
    } catch {
      onError('Une erreur est survenue. Veuillez réessayer.');
      onReloadSejour();
    }
  };

  const handleDrop = async (chambreId: string) => {
    if (!drag) return;
    const body =
      drag.type === 'ELEVE' ? { autorisationId: drag.id } : { accompagnateurId: drag.id };
    setDrag(null);
    try {
      await affecterChambre(sejourId, chambreId, body);
      await load();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        // Capacité dure (D7) : le back tranche — remonter son 409 parlant.
        const e = err as { response?: { data?: { message?: string } } };
        onError(e.response?.data?.message ?? 'Impossible d\'affecter le participant. Veuillez réessayer.');
      }
    }
  };

  const handleRetirer = async (affectationId: string) => {
    try {
      await retirerChambre(affectationId);
      await load();
    } catch (err) {
      if (!isPlanInsufficient(err)) {
        onError('Impossible de retirer le participant. Veuillez réessayer.');
      }
    }
  };

  const chambres = rooming?.chambres ?? [];
  const eleves = rooming?.nonAffectes.eleves ?? [];
  const encadrants = rooming?.nonAffectes.encadrants ?? [];

  function renderDraggable(p: RoomingParticipant, type: 'ELEVE' | 'ENCADRANT') {
    return (
      <div
        key={p.id}
        draggable
        onDragStart={() => setDrag({ id: p.id, type })}
        onDragEnd={() => setDrag(null)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs cursor-grab active:cursor-grabbing"
      >
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold shrink-0">
          {p.prenom?.[0] ?? ''}{p.nom?.[0] ?? ''}
        </div>
        <span className="truncate font-medium text-gray-900">{p.prenom} {p.nom}</span>
        {p.signee && <span className="shrink-0 text-green-500">✓</span>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bandeau clôture inscriptions — répliqué de TabGroupes */}
      {user.role === 'ORGANISATEUR' && !sejour?.inscriptionsCloturees && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Inscriptions ouvertes</p>
            <p className="text-xs text-amber-600 mt-0.5">Clôturez les inscriptions pour répartir les participants dans les chambres.</p>
          </div>
          <button onClick={handleCloturer}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Clôturer les inscriptions
          </button>
        </div>
      )}
      {user.role === 'ORGANISATEUR' && sejour?.inscriptionsCloturees && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium">
          ✓ Inscriptions clôturées — vous pouvez répartir les participants dans les chambres
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      ) : chambres.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          Votre hébergeur doit d&apos;abord vous affecter des chambres à ce séjour.
        </div>
      ) : sejour?.inscriptionsCloturees ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Colonne gauche — participants non affectés */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Élèves non affectés ({eleves.length})
              </h3>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {eleves.map((p) => renderDraggable(p, 'ELEVE'))}
                {eleves.length === 0 && (
                  <p className="text-xs text-gray-300 py-1">Tous les élèves sont affectés.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Encadrants non affectés ({encadrants.length})
              </h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {encadrants.map((p) => renderDraggable(p, 'ENCADRANT'))}
                {encadrants.length === 0 && (
                  <p className="text-xs text-gray-300 py-1">Tous les encadrants sont affectés.</p>
                )}
              </div>
            </div>
          </div>

          {/* Colonne droite — chambres (déjà triées étage/ordre par le back) */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {chambres.map((c) => {
                const et = ETIQUETTES.find((e) => e.label === c.etiquette);
                return (
                  <div
                    key={c.occupationId}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleDrop(c.chambreId); }}
                    className={`rounded-2xl border-2 bg-white p-4 transition-colors ${
                      drag ? 'border-dashed border-[var(--color-primary)] bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{c.nom}</span>
                        {c.etage && <span className="text-xs text-gray-400 shrink-0">{c.etage}</span>}
                        {c.etiquette && (
                          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${et?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.etiquette}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">({c.occupants.length}/{c.capacite})</span>
                    </div>
                    <div className="space-y-1 min-h-8">
                      {c.occupants.map((o) => (
                        <div key={o.affectationId} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1 text-xs">
                          <span className="truncate text-gray-900">
                            {o.prenom} {o.nom}
                            {o.type === 'ENCADRANT' && (
                              <span className="ml-1 text-[10px] text-violet-600">encadrant</span>
                            )}
                          </span>
                          <button onClick={() => handleRetirer(o.affectationId)}
                            className="shrink-0 ml-2 text-gray-300 hover:text-red-400">&times;</button>
                        </div>
                      ))}
                      {c.occupants.length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-2">Glissez un participant ici</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
