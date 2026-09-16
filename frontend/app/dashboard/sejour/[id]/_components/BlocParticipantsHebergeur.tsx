'use client';

import { useState } from 'react';
import type { SejourCollabInfo, Participant } from '@/src/lib/collaboration';
import type { AccompagnateurMission } from '@/src/lib/accompagnateur';
import type { User } from '@/src/types/auth';
import TabParticipantsCollab from './TabParticipantsCollab';
import OuvertureInscriptions from './OuvertureInscriptions';

/**
 * Wrapper hébergeur de l'onglet Participants (Lot 4b) — isole la logique
 * d'ouverture hors de page.tsx :
 * - inscriptions pas ouvertes (ou édition en cours) → écran de cases ;
 * - sinon → bouton « Modifier les champs demandés » + rendu historique
 *   (TabParticipantsCollab, props identiques à page.tsx — aucune régression).
 */
interface Props {
  sejourId: string;
  sejour: SejourCollabInfo | null;
  champsInscription: { champsActifs: string[] } | null;
  onOpened: () => void;
  participants: Participant[];
  accompagnateurs: AccompagnateurMission[];
  user: User;
  onReload: () => void;
}

export default function BlocParticipantsHebergeur({
  sejourId,
  sejour,
  champsInscription,
  onOpened,
  participants,
  accompagnateurs,
  user,
  onReload,
}: Props) {
  const [editing, setEditing] = useState(false);

  // Durcissement 4b : séjour pas encore chargé → ne rien rendre (évite de
  // décider ouvert/fermé sur un état transitoire).
  if (!sejour) return null;

  if (!champsInscription || editing) {
    return (
      <OuvertureInscriptions
        sejourId={sejourId}
        champsInscription={champsInscription}
        onOpened={() => {
          setEditing(false);
          onOpened();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Modifier les champs demandés
        </button>
      </div>
      <TabParticipantsCollab
        sejour={sejour}
        user={user}
        participants={participants}
        accompagnateurs={accompagnateurs}
        onReload={onReload}
      />
    </div>
  );
}
