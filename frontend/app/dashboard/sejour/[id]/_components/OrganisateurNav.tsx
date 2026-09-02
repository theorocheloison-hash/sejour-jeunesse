'use client';

import type { SejourCollabInfo, BudgetData, Participant } from '@/src/lib/collaboration';

type EtatBloc = 'fait' | 'encours' | 'afaire' | 'neutre';

export interface BlocNav {
  key: string;
  titre: string;
  onglets: string[];
  etat: EtatBloc;
  /** Bloc « Sur place » : rendu atténué tant qu'aucun participant n'existe. */
  attenue?: boolean;
}

// ─── Calcul des états et de l'emphase (D4 + D6) ─────────────────────────────

function etatReservation(budgetData: BudgetData | null): EtatBloc {
  const statut = budgetData?.devis?.statut;
  if (!statut) return 'neutre';
  if (statut === 'SELECTIONNE' || statut === 'SIGNE_DIRECTION') return 'fait';
  if (statut === 'EN_ATTENTE_VALIDATION') return 'encours';
  if (statut === 'EN_ATTENTE') return 'afaire';
  return 'neutre';
}

function etatInscriptions(participants: Participant[], participantsCharges: boolean): EtatBloc {
  if (!participantsCharges) return 'neutre';
  if (participants.length === 0) return 'afaire';
  return participants.every((p) => p.signeeAt) ? 'fait' : 'encours';
}

function etatBudget(sejour: SejourCollabInfo | null): EtatBloc {
  return Number(sejour?.prix ?? 0) > 0 ? 'fait' : 'afaire';
}

function etatPedagogie(sejour: SejourCollabInfo | null): EtatBloc {
  return (sejour?.thematiquesPedagogiques?.length ?? 0) > 0 ? 'fait' : 'afaire';
}

/**
 * Bloc mis en avant à l'ouverture : la première « à faire » dans l'ordre
 * Réservation → Inscriptions → Budget → Pédagogie — SAUF si ≥ 1 participant
 * existe : l'activité a commencé, l'emphase bascule en phase 2 (Inscriptions),
 * la signature restant un rappel discret dans l'en-tête (D6/D7).
 */
export function calculerBlocEmphase(
  sejour: SejourCollabInfo | null,
  budgetData: BudgetData | null,
  participants: Participant[],
  participantsCharges: boolean,
): string {
  if (participantsCharges && participants.length >= 1) return 'inscriptions';
  const ordre: Array<[string, EtatBloc]> = [
    ['reservation', etatReservation(budgetData)],
    ['inscriptions', etatInscriptions(participants, participantsCharges)],
    ['budget', etatBudget(sejour)],
    ['pedagogie', etatPedagogie(sejour)],
  ];
  const premierAFaire = ordre.find(([, etat]) => etat === 'afaire' || etat === 'encours');
  return premierAFaire?.[0] ?? 'reservation';
}

/** Onglet ouvert quand on clique un bloc (le premier onglet visible du bloc). */
export const ONGLET_PAR_BLOC: Record<string, string[]> = {
  reservation: ['devis'],
  pedagogie: ['projet'],
  budget: ['budget'],
  inscriptions: ['participants'],
  surplace: ['planning', 'groupes', 'chambres'],
  echanges: ['messages', 'journal', 'documents'],
};

// ─── Rendu ──────────────────────────────────────────────────────────────────

const PASTILLE: Record<EtatBloc, { cls: string; symbole: string; title: string }> = {
  fait: { cls: 'bg-[var(--color-success)] text-white', symbole: '✓', title: 'Fait' },
  encours: { cls: 'bg-blue-500 text-white', symbole: '…', title: 'En cours' },
  afaire: { cls: 'bg-amber-500 text-white', symbole: '!', title: 'À faire' },
  neutre: { cls: 'bg-gray-200 text-gray-500', symbole: '·', title: '' },
};

export interface OrganisateurNavProps {
  sejour: SejourCollabInfo | null;
  budgetData: BudgetData | null;
  participants: Participant[];
  participantsCharges: boolean;
  activeTab: string;
  ongletsVisibles: string[];
  /** Libellés des onglets (source : TABS de page.tsx, non dupliqués ici). */
  labels: Record<string, string>;
  onSelectTab: (tab: string) => void;
}

export default function OrganisateurNav({
  sejour,
  budgetData,
  participants,
  participantsCharges,
  activeTab,
  ongletsVisibles,
  labels,
  onSelectTab,
}: OrganisateurNavProps) {
  const visibles = (onglets: string[]) => onglets.filter((o) => ongletsVisibles.includes(o));

  const blocs: Record<string, BlocNav> = {
    reservation: { key: 'reservation', titre: 'Réservation', onglets: visibles(ONGLET_PAR_BLOC.reservation), etat: etatReservation(budgetData) },
    pedagogie: { key: 'pedagogie', titre: 'Pédagogie', onglets: visibles(ONGLET_PAR_BLOC.pedagogie), etat: etatPedagogie(sejour) },
    budget: { key: 'budget', titre: 'Budget', onglets: visibles(ONGLET_PAR_BLOC.budget), etat: etatBudget(sejour) },
    inscriptions: { key: 'inscriptions', titre: 'Inscriptions', onglets: visibles(ONGLET_PAR_BLOC.inscriptions), etat: etatInscriptions(participants, participantsCharges) },
    surplace: {
      key: 'surplace', titre: 'Sur place', onglets: visibles(ONGLET_PAR_BLOC.surplace), etat: 'neutre',
      attenue: !participantsCharges || participants.length === 0,
    },
    echanges: { key: 'echanges', titre: 'Échanges', onglets: visibles(ONGLET_PAR_BLOC.echanges), etat: 'neutre' },
  };

  const blocEmphase = calculerBlocEmphase(sejour, budgetData, participants, participantsCharges);
  const blocActif = Object.values(blocs).find((b) => b.onglets.includes(activeTab))?.key ?? null;

  const renderBloc = (bloc: BlocNav) => {
    if (bloc.onglets.length === 0) return null;
    const actif = blocActif === bloc.key;
    const emphase = blocEmphase === bloc.key && !actif;
    const pastille = PASTILLE[bloc.etat];
    return (
      <button
        key={bloc.key}
        onClick={() => onSelectTab(bloc.onglets[0])}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          actif
            ? 'border-[var(--color-border-strong)] bg-[var(--color-primary-light)] text-[var(--color-primary)]'
            : emphase
              ? 'border-[var(--color-accent)] bg-white text-gray-900 ring-1 ring-[var(--color-accent)]'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        } ${bloc.attenue && !actif ? 'opacity-60' : ''}`}
      >
        {bloc.etat !== 'neutre' && (
          <span
            title={pastille.title}
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${pastille.cls}`}
          >
            {pastille.symbole}
          </span>
        )}
        {bloc.titre}
        {emphase && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Prochaine étape
          </span>
        )}
      </button>
    );
  };

  const sousOnglets = blocActif ? blocs[blocActif].onglets : [];

  return (
    <div className="bg-white border-b border-gray-200 print:hidden">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
        <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              1 · Je monte mon dossier
            </p>
            <div className="flex flex-wrap gap-2">
              {[blocs.reservation, blocs.pedagogie, blocs.budget].map(renderBloc)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              2 · J&apos;organise le séjour
            </p>
            <div className="flex flex-wrap gap-2">
              {[blocs.inscriptions, blocs.surplace].map(renderBloc)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Avec l&apos;hébergeur
            </p>
            <div className="flex flex-wrap gap-2">{renderBloc(blocs.echanges)}</div>
          </div>
        </div>

        {/* Sous-onglets du bloc actif (uniquement s'il en a plusieurs) */}
        {sousOnglets.length > 1 && (
          <div className="flex gap-5 overflow-x-auto border-t border-gray-100 pt-2">
            {sousOnglets.map((key) => (
              <button
                key={key}
                onClick={() => onSelectTab(key)}
                className={`shrink-0 whitespace-nowrap pb-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {labels[key] ?? key}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
