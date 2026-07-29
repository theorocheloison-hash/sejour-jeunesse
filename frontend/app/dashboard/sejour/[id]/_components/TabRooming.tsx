'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getRoomingCollab,
  affecterChambre,
  retirerChambre,
  cloturerInscriptions,
  type RoomingData,
  type SejourCollabInfo,
} from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import RoomingEditor from './RoomingEditor';
import RoomingPlanView from './RoomingPlanView';
import RoomingPlanPDFButton from '@/src/components/pdf/RoomingPlanPDFButton';

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
  const [vue, setVue] = useState<'edition' | 'plan'>('edition');

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

  const handleAffecter = async (chambreId: string, body: { autorisationId?: string; accompagnateurId?: string }) => {
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
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Toggle Édition | Plan — le plan (lecture seule) est toujours
                visible, y compris inscriptions ouvertes */}
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(['edition', 'plan'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVue(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    vue === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v === 'edition' ? 'Édition' : 'Plan'}
                </button>
              ))}
            </div>
            <RoomingPlanPDFButton
              planProps={{
                titreSejour: sejour?.titre ?? 'Séjour',
                dateDebut: sejour?.dateDebut ?? null,
                dateFin: sejour?.dateFin ?? null,
                centreName: sejour?.hebergementSelectionne?.nom,
                rooming: rooming!,
              }}
              filename={`plan-chambres-${sejour?.titre ?? 'sejour'}.pdf`}
            />
          </div>

          {vue === 'plan' ? (
            <RoomingPlanView rooming={rooming!} />
          ) : sejour?.inscriptionsCloturees ? (
            <RoomingEditor rooming={rooming!} onAffecter={handleAffecter} onRetirer={handleRetirer} />
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
              Clôturez les inscriptions pour répartir les participants. En attendant, l&apos;onglet « Plan » affiche les chambres attribuées.
            </div>
          )}
        </>
      )}
    </div>
  );
}
