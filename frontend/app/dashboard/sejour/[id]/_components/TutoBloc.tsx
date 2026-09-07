'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FICHES_TUTO } from '@/src/data/tuto-blocs';

// Panneau « Tutoriel » de l'espace organisateur (Lot 1 onboarding) : une fiche
// par écran, pilotée par l'onglet actif. Repliable à la DetailsSejourPanel —
// état de session pur (pas de localStorage ; le flag « tour vu » viendra au Lot 2).

interface TutoBlocProps {
  activeTab: string;
  vueReservation: 'devis' | 'documents';
  devisSigne: boolean;
}

// Onglet → clé de fiche. L'onglet devis se dédouble selon la sous-vue Réservation
// (P7) ; un onglet sans fiche (notes…) ne rend rien.
const FICHE_PAR_ONGLET: Record<string, string> = {
  projet: 'projet',
  budget: 'budget',
  participants: 'participants',
  groupes: 'groupes',
  planning: 'planning',
  chambres: 'chambres',
  messages: 'messages',
  journal: 'journal',
  documents: 'documents-partages',
};

function cleFiche(activeTab: string, vueReservation: 'devis' | 'documents', devisSigne: boolean): string | null {
  if (activeTab === 'devis') {
    return devisSigne && vueReservation === 'documents' ? 'documents-officiels' : 'devis';
  }
  return FICHE_PAR_ONGLET[activeTab] ?? null;
}

export default function TutoBloc({ activeTab, vueReservation, devisSigne }: TutoBlocProps) {
  const [open, setOpen] = useState(true);

  const cle = cleFiche(activeTab, vueReservation, devisSigne);
  const fiche = cle ? FICHES_TUTO[cle] : undefined;
  if (!fiche) return null;

  const Icone = fiche.icon;
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Replier le tutoriel' : 'Déplier le tutoriel'}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Icone className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
        <span className="text-sm font-semibold text-gray-900">{fiche.titre}</span>
        <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
          Tutoriel
        </span>
        <Chevron className="ml-auto h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3 text-sm leading-relaxed text-gray-700">
          {fiche.accroche && <p className="text-xs italic text-gray-500">{fiche.accroche}</p>}
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">À quoi ça sert</p>
            <p>{fiche.aQuoi}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ce que vous pouvez faire</p>
            <p>{fiche.actions}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Comment faire</p>
            <p>{fiche.comment}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Bon à savoir</p>
            <p>{fiche.bonASavoir}</p>
          </div>
        </div>
      )}
    </div>
  );
}
