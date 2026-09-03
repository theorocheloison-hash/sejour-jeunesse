'use client';

import { useState } from 'react';
import { cloturerInscriptions } from '@/src/lib/collaboration';

const TEXTES: Record<string, { invite: string; fait: string }> = {
  inscriptions: {
    invite: 'Quand votre liste est complète, clôturez les inscriptions pour préparer les groupes et les chambres.',
    fait: '✓ Inscriptions clôturées',
  },
  groupes: {
    invite: 'Clôturez les inscriptions pour affecter les élèves aux groupes.',
    fait: '✓ Inscriptions clôturées — vous pouvez affecter les élèves aux groupes',
  },
  chambres: {
    invite: 'Clôturez les inscriptions pour répartir les participants dans les chambres.',
    fait: '✓ Inscriptions clôturées — vous pouvez répartir les participants dans les chambres',
  },
};

/**
 * Clôture des inscriptions (P5) — composant UNIQUE : remplace les deux bandeaux
 * inline dupliqués de TabGroupes et TabRooming, et s'ajoute au bloc
 * Inscriptions. Le backend de la clôture est inchangé
 * (POST /collaboration/:id/cloturer-inscriptions).
 */
export default function ClotureInscriptions({
  sejourId,
  cloturee,
  variant,
  onDone,
  onError,
}: {
  sejourId: string;
  cloturee: boolean;
  variant: 'inscriptions' | 'groupes' | 'chambres';
  /** Appelé après clôture réussie (le parent met à jour/recharge le séjour). */
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const textes = TEXTES[variant];

  if (cloturee) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium">
        {textes.fait}
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-amber-800">Inscriptions ouvertes</p>
        <p className="text-xs text-amber-600 mt-0.5">{textes.invite}</p>
      </div>
      <button
        onClick={async () => {
          setLoading(true);
          try {
            await cloturerInscriptions(sejourId);
            onDone();
          } catch {
            onError('Une erreur est survenue. Veuillez réessayer.');
          } finally {
            setLoading(false);
          }
        }}
        disabled={loading}
        className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? 'Clôture…' : 'Clôturer les inscriptions'}
      </button>
    </div>
  );
}
