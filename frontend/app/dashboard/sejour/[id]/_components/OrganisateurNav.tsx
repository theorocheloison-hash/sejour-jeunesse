'use client';

import { useState } from 'react';
import type { SejourCollabInfo, BudgetData, Participant } from '@/src/lib/collaboration';
import { calculerBudgetTotaux } from '@/src/lib/budget-solde';
import SousOnglets from './SousOnglets';

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

function etatInscriptions(
  sejour: SejourCollabInfo | null,
  participants: Participant[],
  participantsCharges: boolean,
): EtatBloc {
  // P5 : « fait » = inscriptions clôturées (le geste explicite de l'enseignant),
  // « en cours » = liste entamée non clôturée, « à faire » = liste vide.
  if (sejour?.inscriptionsCloturees) return 'fait';
  if (!participantsCharges) return 'neutre';
  return participants.length === 0 ? 'afaire' : 'encours';
}

function etatBudget(sejour: SejourCollabInfo | null, budgetData: BudgetData | null): EtatBloc {
  // P6 : « fait » = budget BOUCLÉ (solde ≥ 0 avec au moins une donnée saisie),
  // pas simplement un prix posé. « en cours » = données saisies mais solde
  // négatif. « à faire » = rien. Même calcul que l'affichage de TabBudget
  // (helper unique calculerBudgetTotaux).
  if (!budgetData) return 'neutre';
  const { totalDepenses, totalRecettes, solde } = calculerBudgetTotaux(
    budgetData.devis,
    budgetData.lignesCompl ?? [],
    budgetData.recettes ?? [],
  );
  const donneeSaisie = totalDepenses > 0 || totalRecettes > 0 || Number(sejour?.prix ?? 0) > 0;
  if (!donneeSaisie) return 'afaire';
  return solde >= 0 ? 'fait' : 'encours';
}

function etatPedagogie(sejour: SejourCollabInfo | null): EtatBloc {
  return (sejour?.thematiquesPedagogiques?.length ?? 0) > 0 ? 'fait' : 'afaire';
}

/**
 * Bloc mis en avant à l'ouverture (D4/D6, réécrit en P5) :
 * — ≥ 1 participant : l'activité a commencé → Inscriptions tant que non clôturé ;
 *   une fois clôturé, retour sur le premier bloc de phase 1 restant
 *   (Réservation → Budget → Pédagogie) ; si plus rien → null (« Tout est prêt ✓ »).
 * — 0 participant : premier « à faire »/« en cours » dans l'ordre historique
 *   Réservation → Inscriptions → Budget → Pédagogie ; null si tout est fait.
 */
export function calculerBlocEmphase(
  sejour: SejourCollabInfo | null,
  budgetData: BudgetData | null,
  participants: Participant[],
  participantsCharges: boolean,
): string | null {
  const etats: Record<string, EtatBloc> = {
    reservation: etatReservation(budgetData),
    inscriptions: etatInscriptions(sejour, participants, participantsCharges),
    budget: etatBudget(sejour, budgetData),
    pedagogie: etatPedagogie(sejour),
  };
  const aTraiter = (e: EtatBloc) => e === 'afaire' || e === 'encours';

  if (participantsCharges && participants.length >= 1) {
    if (aTraiter(etats.inscriptions)) return 'inscriptions';
    for (const k of ['reservation', 'budget', 'pedagogie']) {
      if (aTraiter(etats[k])) return k;
    }
    return null;
  }

  for (const k of ['reservation', 'inscriptions', 'budget', 'pedagogie']) {
    if (aTraiter(etats[k])) return k;
  }
  return null;
}

/** Onglet ouvert quand on clique un bloc (le premier onglet visible du bloc).
 * P12.3 : « Sur place » s'ouvre sur Groupes pour l'organisateur (le planning est
 * en lecture seule pour lui, sa tâche est la répartition) — l'accompagnateur
 * garde sa barre historique (ACCOMPAGNATEUR_TABS, défaut planning, intacts).
 * Si `groupes` n'est pas visible (événement…), le premier visible du bloc prend
 * le relais (filtre `visibles()`). */
export const ONGLET_PAR_BLOC: Record<string, string[]> = {
  reservation: ['devis'],
  pedagogie: ['projet'],
  budget: ['budget'],
  inscriptions: ['participants'],
  surplace: ['groupes', 'planning', 'chambres'],
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
  /** Sous-vue locale du bloc Réservation (P7) : 'devis' | 'documents'. Pas une
   * key de TABS — ongletsVisibles/tracking/accompagnateur intacts. */
  vueReservation: 'devis' | 'documents';
  onVueReservation: (vue: 'devis' | 'documents') => void;
  /** Documents officiels accessibles (devis signé) : sinon un seul sous-onglet,
   * pas de barre. */
  documentsDisponibles: boolean;
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
  vueReservation,
  onVueReservation,
  documentsDisponibles,
}: OrganisateurNavProps) {
  const visibles = (onglets: string[]) => onglets.filter((o) => ongletsVisibles.includes(o));

  // P12.2 — aide à la découverte des sous-onglets : mémorise (en session, pas de
  // localStorage) les blocs dont l'utilisateur a déjà cliqué une vue ; tant que
  // ce n'est pas fait, une ligne d'aide s'affiche au-dessus de la sous-barre.
  const [aideVue, setAideVue] = useState<Record<string, boolean>>({});
  const marquerAideVue = (blocKey: string) =>
    setAideVue((prev) => (prev[blocKey] ? prev : { ...prev, [blocKey]: true }));

  const blocs: Record<string, BlocNav> = {
    reservation: { key: 'reservation', titre: 'Réservation', onglets: visibles(ONGLET_PAR_BLOC.reservation), etat: etatReservation(budgetData) },
    pedagogie: { key: 'pedagogie', titre: 'Pédagogie', onglets: visibles(ONGLET_PAR_BLOC.pedagogie), etat: etatPedagogie(sejour) },
    budget: { key: 'budget', titre: 'Budget', onglets: visibles(ONGLET_PAR_BLOC.budget), etat: etatBudget(sejour, budgetData) },
    inscriptions: { key: 'inscriptions', titre: 'Inscriptions', onglets: visibles(ONGLET_PAR_BLOC.inscriptions), etat: etatInscriptions(sejour, participants, participantsCharges) },
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
    // P12.1 — un bloc multi-vues l'annonce dans son libellé (« · N vues »).
    const nbVues = bloc.key === 'reservation'
      ? (documentsDisponibles ? 2 : 1)
      : bloc.onglets.length;
    return (
      <button
        key={bloc.key}
        onClick={() => {
          // Ouvrir un bloc = son premier sous-onglet ; Réservation retombe sur Devis (P7).
          if (bloc.key === 'reservation') onVueReservation('devis');
          onSelectTab(bloc.onglets[0]);
        }}
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
        {nbVues >= 2 && (
          /* P13 : forme courte « · N » (title au survol) pour que la nav tienne
             sur une ligne en trois colonnes à ~1280 px. */
          <span title={`${nbVues} vues`} className="text-[10px] font-normal text-gray-400">· {nbVues}</span>
        )}
        {emphase && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            Prochaine étape
          </span>
        )}
      </button>
    );
  };

  // Sous-vues du bloc actif : onglets réels (Sur place, Échanges) ou sous-vue
  // locale Réservation (P7 : Devis | Documents officiels, si devis signé).
  const sousVues: Array<{ key: string; label: string; actif: boolean; onSelect: () => void }> =
    blocActif === 'reservation'
      ? (documentsDisponibles
          ? [
              { key: 'devis', label: labels.devis ?? 'Devis', actif: vueReservation === 'devis', onSelect: () => { marquerAideVue('reservation'); onVueReservation('devis'); } },
              { key: 'documents-officiels', label: 'Documents officiels', actif: vueReservation === 'documents', onSelect: () => { marquerAideVue('reservation'); onVueReservation('documents'); } },
            ]
          : [])
      : blocActif
        ? blocs[blocActif].onglets.map((key) => ({
            key,
            label: labels[key] ?? key,
            actif: activeTab === key,
            onSelect: () => { marquerAideVue(blocActif); onSelectTab(key); },
          }))
        : [];

  // P12.2 — libellés « A, B ou C » pour la ligne d'aide.
  const libellesAide = sousVues.length > 1
    ? sousVues.map((v) => v.label).reduce((acc, label, i, arr) =>
        i === 0 ? label : i === arr.length - 1 ? `${acc} ou ${label}` : `${acc}, ${label}`, '')
    : '';
  const aideVisible = sousVues.length > 1 && !!blocActif && !aideVue[blocActif];

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
          {/* P5 : plus aucune étape en attente → pas d'emphase, on le dit. */}
          {blocEmphase === null && (
            <div className="flex items-end pb-0.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-semibold text-green-700">
                Tout est prêt ✓
              </span>
            </div>
          )}
        </div>

        {/* P12.2 — aide à la première ouverture d'un bloc multi-vues, disparaît
            (pour la session) au premier clic sur un sous-onglet du bloc. */}
        {aideVisible && (
          <p className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] transition-opacity duration-300">
            Choisissez une vue : {libellesAide}
            <span aria-hidden>↓</span>
          </p>
        )}
        {/* Sous-onglets du bloc actif — vrais onglets au gabarit historique (P8) */}
        <SousOnglets vues={sousVues} />
      </div>
    </div>
  );
}
