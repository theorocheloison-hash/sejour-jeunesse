'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getSejourCollabInfo,
  getParticipants,
  getBudgetData,
  getGroupes,
  marquerVisite,
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  Participant,
  BudgetData,
  GroupeSejour,
} from '@/src/lib/collaboration';
import {
  getAccompagnateursBySejour,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';
import { THEMATIQUES, NIVEAUX, type Niveau } from '@/src/data/thematiques-pedagogiques';
import api from '@/src/lib/api';
import TabDevisFacturation from './_components/TabDevisFacturation';
import TabMessages from './_components/TabMessages';
import TabPlanning from './_components/TabPlanning';
import TabGroupes from './_components/TabGroupes';
import TabDocuments from './_components/TabDocuments';
import TabBudget from './_components/TabBudget';
import TabProjetPedagogique from './_components/TabProjetPedagogique';
import TabJournal from './_components/TabJournal';
import TabParticipantsCollab from './_components/TabParticipantsCollab';
import TabNotes from './_components/TabNotes';
import TabChambres from './_components/TabChambres';
import TabRooming from './_components/TabRooming';
import SejourHeader from './_components/SejourHeader';
import AlertesCapacite from '../../_shared/AlertesCapacite';
import OrganisateurNav, { calculerBlocEmphase, ONGLET_PAR_BLOC } from './_components/OrganisateurNav';
import EncartAide from './_components/EncartAide';
import InscriptionsEleves from './_components/InscriptionsEleves';
import Accompagnateurs from './_components/Accompagnateurs';
import PrixParEleve from './_components/PrixParEleve';
import DocumentsOfficiels from './_components/DocumentsOfficiels';

// ─── Onglets ────────────────────────────────────────────────────────────────

type Tab = 'devis' | 'messages' | 'planning' | 'groupes' | 'participants' | 'chambres' | 'documents' | 'budget' | 'projet' | 'journal' | 'notes';

const TABS: { key: Tab; label: string }[] = [
  { key: 'devis', label: 'Devis' },
  { key: 'messages', label: 'Messages' },
  { key: 'planning', label: 'Planning' },
  { key: 'groupes', label: 'Groupes' },
  { key: 'participants', label: 'Participants' },
  { key: 'chambres', label: 'Chambres' },
  { key: 'documents', label: 'Documents' },
  { key: 'journal', label: 'Journal' },
  { key: 'budget', label: 'Budget prévisionnel' },
  { key: 'projet', label: 'Projet pédagogique' },
  { key: 'notes', label: 'Notes & suivi' },
];

const ACCOMPAGNATEUR_TABS: Tab[] = ['planning', 'participants', 'groupes', 'chambres', 'journal'];


// ─── Page ───────────────────────────────────────────────────────────────────

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);
  const isDirect = sejour?.modeGestion === 'DIRECT';
  // Gate lecture seule hébergeur : ne restreint QUE les collaborateurs de centre
  // (role HEBERGEUR). Organisateur/signataire n'ont pas de permissions de centre
  // (mesPermissions null) mais ne sont pas concernés → canWrite=true pour eux.
  const canWriteSejour = user?.role !== 'HEBERGEUR' || (sejour?.mesPermissions?.sejours === 'WRITE');
  const isEvenement = sejour?.natureSejour === 'EVENEMENT';
  const [tab, setTab] = useState<Tab>('devis');
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Groupes (partagé avec l'onglet planning — export PDF)
  const [groupes, setGroupes] = useState<GroupeSejour[]>([]);

  // Participants (partagé : onglets participants + groupes ; nav blocs organisateur)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsCharges, setParticipantsCharges] = useState(false);

  // Accompagnateurs
  const [accompagnateurs, setAccompagnateurs] = useState<AccompagnateurMission[]>([]);
  const monRoleCollaboratif = useMemo(() => {
    if (!user || !accompagnateurs) return null;
    const moi = accompagnateurs.find((a) => a.userId === user.id && a.accesCollaboratif);
    return moi?.roleCollaboratif ?? null;
  }, [user, accompagnateurs]);
  const estLectureSeule = monRoleCollaboratif === 'LECTURE';
  const estAccompagnateur = monRoleCollaboratif !== null && sejour?.createur?.id !== user?.id;

  // Nav par blocs (D4/D10) — organisateur CRÉATEUR uniquement. « Créateur prouvé »
  // plutôt que !estAccompagnateur : estAccompagnateur n'est vrai qu'après le fetch
  // async des accompagnateurs, un accompagnateur verrait sinon la nav blocs le temps
  // du chargement (vigilance §8.2). Créateur ⇒ !estAccompagnateur par définition.
  // DIRECT et événementiel gardent la barre actuelle (pas d'organisateur créateur
  // en DIRECT ; l'événementiel filtre la moitié des onglets).
  const navBlocs = user?.role === 'ORGANISATEUR' && !!sejour && sejour.createur?.id === user.id
    && !isDirect && !isEvenement;

  // Onglets réellement visibles pour l'utilisateur courant. Reprend À L'IDENTIQUE les
  // conditions de la barre (rôle / accompagnateur / isEvenement / isDirect) et ajoute
  // le gating permissions HEBERGEUR : Devis masqué si devis:NONE, Notes si crm:NONE.
  const ongletsVisibles = useMemo<Tab[]>(() => {
    const role = user?.role;
    return TABS.filter((t) =>
      estAccompagnateur
        ? ACCOMPAGNATEUR_TABS.includes(t.key)
        : (
          (t.key !== 'projet' || role === 'ORGANISATEUR') &&
          (t.key !== 'budget' || role === 'ORGANISATEUR' || role === 'SIGNATAIRE') &&
          (t.key !== 'groupes' || role === 'ORGANISATEUR' || role === 'HEBERGEUR') &&
          (t.key !== 'journal' || role === 'ORGANISATEUR' || role === 'HEBERGEUR') &&
          (t.key !== 'notes' || (role === 'HEBERGEUR' && sejour?.mesPermissions?.crm !== 'NONE')) &&
          (t.key !== 'chambres' || role === 'HEBERGEUR' || role === 'ORGANISATEUR') &&
          (t.key !== 'devis' || !(role === 'HEBERGEUR' && sejour?.mesPermissions?.devis === 'NONE'))
        )
      )
      .filter((t) => {
        if (isEvenement && (t.key === 'groupes' || t.key === 'projet' || t.key === 'participants' || t.key === 'journal' || t.key === 'chambres')) return false;
        if (isDirect && (t.key === 'budget' || t.key === 'projet')) return false;
        return true;
      })
      .map((t) => t.key);
  }, [user, sejour, estAccompagnateur, isEvenement, isDirect]);

  // Onglet réellement affiché : toujours un onglet visible (l'état `tab` peut pointer
  // sur un onglet masqué → on bascule sur le premier visible sans muter le state).
  const activeTab: Tab = ongletsVisibles.includes(tab) ? tab : (ongletsVisibles[0] ?? tab);

  // ── Tracking visite onglet (notifications hébergeur) — sur l'onglet AFFICHÉ ──
  useEffect(() => {
    const ONGLETS_TRACKING = ['messages', 'documents', 'journal'];
    if (!user || user.role !== 'HEBERGEUR' || !id || !ONGLETS_TRACKING.includes(activeTab)) return;
    marquerVisite(id, activeTab).catch(() => {});
  }, [activeTab, user, id]);

  // Budget (partagé : onglet devis via TabDevisFacturation + onglet budget)
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Thématiques pédagogiques manquantes
  const [showThematiquesForm, setShowThematiquesForm] = useState(false);
  const [thematiquesNiveau, setThematiquesNiveau] = useState('');
  const [thematiquesSelectionnees, setThematiquesSelectionnees] = useState<string[]>([]);
  const [savingThematiques, setSavingThematiques] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'ORGANISATEUR' && user.role !== 'HEBERGEUR' && user.role !== 'SIGNATAIRE'))) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // ── Load séjour info ──
  useEffect(() => {
    if (!id || !user) return;
    getSejourCollabInfo(id).then((data) => {
      setSejour(data);
      getAccompagnateursBySejour(id).then(setAccompagnateurs).catch(() => {});
    }).catch(() => setError('Impossible de charger les informations du séjour.'));
  }, [id, user]);

  // Bascule DIRECT → COLLABORATIF : si l'organisateur accepte l'invitation pendant
  // que l'onglet reste ouvert, on rafraîchit les infos au retour de focus pour que
  // l'écran d'invitation laisse place à la vraie messagerie (modeGestion change).
  useEffect(() => {
    if (!id || !user) return;
    const onFocus = () => {
      getSejourCollabInfo(id).then(setSejour).catch(() => {});
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [id, user]);

  // ── Load tab data ──
  const loadParticipants = useCallback(async () => {
    if (!id) return;
    try {
      const [p, acc] = await Promise.all([
        getParticipants(id),
        getAccompagnateursBySejour(id),
      ]);
      setParticipants(p);
      setAccompagnateurs(acc);
      setParticipantsCharges(true);
    } catch { /* ignore */ }
  }, [id]);

  const loadBudget = useCallback(async () => {
    if (!id) return;
    setBudgetLoading(true);
    try {
      const data = await getBudgetData(id);
      setBudgetData(data);
    } catch { /* ignore */ }
    finally { setBudgetLoading(false); }
  }, [id]);

  // Refresh après signature côté organisateur : budgetData (statut du devis) + séjour.
  const reloadApresSignature = useCallback(async () => {
    await loadBudget();
    getSejourCollabInfo(id).then(setSejour).catch(() => {});
  }, [loadBudget, id]);

  // Bandeau « devis à signer » : charger budgetData au montage pour l'organisateur en
  // collaboratif, indépendamment de l'onglet actif (le bandeau doit être visible partout).
  useEffect(() => {
    if (user?.role === 'ORGANISATEUR' && !isDirect) loadBudget();
  }, [user?.role, isDirect, loadBudget]);

  // Nav blocs : le compte de participants nourrit états et emphase (D6) → charger
  // au montage pour l'organisateur créateur (fetch existant, déclenché plus tôt).
  useEffect(() => {
    if (navBlocs) loadParticipants();
  }, [navBlocs, loadParticipants]);

  // Onglet par défaut = bloc en emphase, pour l'organisateur créateur seulement,
  // posé UNE fois quand les données nécessaires sont là — sauf si l'utilisateur
  // a déjà cliqué (selectTab). Le useState('devis') et le fallback activeTab
  // restent inchangés pour les autres rôles.
  const ongletChoisiRef = useRef(false);
  const selectTab = useCallback((t: Tab) => {
    ongletChoisiRef.current = true;
    setTab(t);
  }, []);
  useEffect(() => {
    if (!navBlocs || ongletChoisiRef.current || !budgetData || !participantsCharges) return;
    ongletChoisiRef.current = true;
    const bloc = calculerBlocEmphase(sejour, budgetData, participants, participantsCharges);
    const onglet = ONGLET_PAR_BLOC[bloc]?.[0];
    if (onglet) setTab(onglet as Tab);
  }, [navBlocs, budgetData, participantsCharges, participants, sejour]);

  // Mode d'inscription D14 (bloc Inscriptions, organisateur créateur) : déduit des
  // données existantes — ≥1 participant SAISIE_DIRECTE → saisie ; ≥1 participant
  // sinon → familles ; aucun élève → l'enseignant choisit.
  const [modeInscriptionChoisi, setModeInscriptionChoisi] = useState<'FAMILLES' | 'SAISIE' | null>(null);
  const modeInscriptionDetecte: 'FAMILLES' | 'SAISIE' | null = !participantsCharges || participants.length === 0
    ? null
    : participants.some((p) => p.sourceInscription === 'SAISIE_DIRECTE')
      ? 'SAISIE'
      : 'FAMILLES';
  const modeInscription = modeInscriptionDetecte ?? modeInscriptionChoisi;

  // Devis signé (D11/D12) : conditionne accompagnateurs et enregistrement du prix.
  const devisSigne = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE']
    .includes(budgetData?.devis?.statut ?? '');

  // Badge d'engagement D7/D8 (organisateur créateur seulement) : dérivé du statut
  // du devis (source déjà chargée), fallback statut séjour tant que budgetData
  // n'est pas là. null pour les autres rôles → SejourHeader garde son badge actuel.
  const badgeEngagement = useMemo(() => {
    if (!navBlocs) return null;
    const confirme = { label: 'Séjour confirmé ✓', cls: 'bg-green-100 text-green-700' };
    const attente = { label: 'En attente de signature', cls: 'bg-amber-100 text-amber-700' };
    const ds = budgetData?.devis?.statut;
    if (ds === 'EN_ATTENTE') return attente;
    if (ds === 'EN_ATTENTE_VALIDATION') return { label: 'En cours de validation direction', cls: 'bg-blue-100 text-blue-700' };
    if (ds === 'SELECTIONNE' || ds === 'SIGNE_DIRECTION' || ds === 'FACTURE_ACOMPTE' || ds === 'FACTURE_SOLDE') return confirme;
    if (ds === 'NON_RETENU') return { label: 'Annulé', cls: 'bg-gray-100 text-gray-600' };
    if (sejour?.statut === 'CONVENTION' || sejour?.statut === 'SIGNE_DIRECTION') return confirme;
    if (sejour?.statut === 'OPTION') return attente;
    return null;
  }, [navBlocs, budgetData, sejour]);

  useEffect(() => {
    if (activeTab === 'devis' && !isDirect) loadBudget();
    if (activeTab === 'groupes') {
      getGroupes(id).then(setGroupes).catch(() => {});
      loadParticipants();
    }
    if (activeTab === 'participants') loadParticipants();
    if (activeTab === 'budget') loadBudget();
  }, [activeTab, isDirect, id, loadParticipants, loadBudget]);

  // ── Save thématiques ──
  const handleSaveThematiques = async () => {
    if (thematiquesSelectionnees.length === 0) return;
    setSavingThematiques(true);
    try {
      await api.patch(`/sejours/${id}/thematiques`, { thematiques: thematiquesSelectionnees });
      setSejour(prev => prev ? { ...prev, thematiquesPedagogiques: thematiquesSelectionnees } : prev);
      setShowThematiquesForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingThematiques(false);
    }
  };

  // ── Loading / Error ──
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-red-50 border border-red-200 px-6 py-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const retourHref = user.role === 'ORGANISATEUR' ? '/dashboard/organisateur' : user.role === 'SIGNATAIRE' ? '/dashboard/signataire' : '/dashboard/hebergeur/sejours';
  const isDirector = user.role === 'SIGNATAIRE';

  // Bandeau « thématiques manquantes » — JSX unique (déplacé, jamais dupliqué) :
  // rendu à sa position historique quand !navBlocs (accompagnateur et autres cas
  // ORGANISATEUR actuels), et en tête de la section Pédagogie quand navBlocs (SC3).
  const bandeauThematiques = user.role === 'ORGANISATEUR' && sejour && (!sejour.thematiquesPedagogiques || sejour.thematiquesPedagogiques.length === 0) ? (
        <div className="bg-amber-50 border-b border-amber-200 print:hidden">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            {!showThematiquesForm ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-amber-800">
                  <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span><strong>Thématiques pédagogiques manquantes</strong> — Ajoutez-les pour compléter votre dossier pédagogique</span>
                </div>
                <button
                  onClick={() => setShowThematiquesForm(true)}
                  className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
                >
                  Compléter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <svg className="h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  Compléter les thématiques pédagogiques
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Niveau de classe</label>
                  <select
                    value={thematiquesNiveau}
                    onChange={(e) => { setThematiquesNiveau(e.target.value); setThematiquesSelectionnees([]); }}
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                  >
                    <option value="">Sélectionner un niveau</option>
                    {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                {thematiquesNiveau && THEMATIQUES[thematiquesNiveau as Niveau] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {THEMATIQUES[thematiquesNiveau as Niveau].map((t) => (
                      <label key={t} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                        thematiquesSelectionnees.includes(t)
                          ? 'border-amber-400 bg-amber-100 text-amber-900 font-medium'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}>
                        <input
                          type="checkbox"
                          checked={thematiquesSelectionnees.includes(t)}
                          onChange={() => setThematiquesSelectionnees(prev =>
                            prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
                          )}
                          className="sr-only"
                        />
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          thematiquesSelectionnees.includes(t) ? 'border-amber-500 bg-amber-600' : 'border-gray-300'
                        }`}>
                          {thematiquesSelectionnees.includes(t) && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </span>
                        {t}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveThematiques}
                    disabled={savingThematiques || thematiquesSelectionnees.length === 0}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingThematiques ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={() => { setShowThematiquesForm(false); setThematiquesNiveau(''); setThematiquesSelectionnees([]); }}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
  ) : null;

  return (
    <div>

      {/* ── Barre de contexte sticky (header séjour) ─── */}
      {sejour && user && (
        <SejourHeader
          sejourId={id}
          sejour={sejour}
          user={user}
          isDirect={isDirect}
          isEvenement={isEvenement}
          retourHref={retourHref}
          badgeEngagement={badgeEngagement}
          onSejourUpdate={(updates) => setSejour(prev => prev ? { ...prev, ...updates } : prev)}
          onError={setMutationError}
          onDeleted={() => router.push('/dashboard/hebergeur/planning')}
        />
      )}

      {mutationError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 print:hidden">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 text-sm text-red-700">
            <span>{mutationError}</span>
            <button onClick={() => setMutationError(null)} className="text-red-500 hover:text-red-700 shrink-0">×</button>
          </div>
        </div>
      )}

      {/* ── Alerte capacité globale (hébergeur, séjour OPTION plus accueillable) ── */}
      <AlertesCapacite sejourId={id} />

      {/* ── Bandeau thématiques manquantes — pour l'organisateur créateur (navBlocs),
             il est DÉPLACÉ dans la section Pédagogie (rendu plus bas), pas ici. ── */}
      {!navBlocs && bandeauThematiques}

      {/* ── Bandeau devis à signer (organisateur) — retiré pour l'organisateur
             créateur (navBlocs) : le badge D7/D8 du header porte le rappel (P1).
             L'accompagnateur (navBlocs faux) le voit toujours. ──────────────── */}
      {user.role === 'ORGANISATEUR' && !navBlocs && budgetData?.devis && budgetData.devis.sejourDirectId &&
        (budgetData.devis.statut === 'EN_ATTENTE' || budgetData.devis.statut === 'EN_ATTENTE_VALIDATION') && (
        <div className={`border-b print:hidden ${budgetData.devis.statut === 'EN_ATTENTE' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className={`flex items-center gap-2 text-sm ${budgetData.devis.statut === 'EN_ATTENTE' ? 'text-amber-800' : 'text-blue-800'}`}>
                <svg className={`h-5 w-5 shrink-0 ${budgetData.devis.statut === 'EN_ATTENTE' ? 'text-amber-500' : 'text-blue-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>
                  {budgetData.devis.statut === 'EN_ATTENTE'
                    ? "Ce devis n'est pas encore signé — signez-le pour confirmer votre réservation."
                    : 'Devis en attente de validation par votre direction.'}
                </span>
              </div>
              {activeTab !== 'devis' && (
                <button
                  onClick={() => selectTab('devis')}
                  className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors ${budgetData.devis.statut === 'EN_ATTENTE' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  Voir le devis
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Navigation : blocs guidés pour l'organisateur créateur (SC3),
             barre d'onglets INCHANGÉE pour tous les autres rôles ─────────── */}
      {navBlocs ? (
        <>
          <EncartAide />
          <OrganisateurNav
            sejour={sejour}
            budgetData={budgetData}
            participants={participants}
            participantsCharges={participantsCharges}
            activeTab={activeTab}
            ongletsVisibles={ongletsVisibles}
            labels={Object.fromEntries(TABS.map((t) => [t.key, t.label]))}
            onSelectTab={(t) => selectTab(t as Tab)}
          />
        </>
      ) : (
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* overflow-x-auto : sur mobile les onglets débordent et doivent rester atteignables */}
          <div className="flex gap-6 overflow-x-auto">
            {ongletsVisibles.map((key) => {
              const t = TABS.find((x) => x.key === key);
              if (!t) return null;
              const label = key === 'planning' && isEvenement ? 'Programme' : t.label;
              return (
                <button
                  key={key}
                  onClick={() => selectTab(key)}
                  className={`shrink-0 whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === key
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Devis & facturation (DIRECT + COLLABORATIF) ─── */}
        {activeTab === 'devis' && sejour && (
          <div className="space-y-8">
            <TabDevisFacturation
              sejourId={id}
              sejour={sejour}
              user={user}
              isDirect={isDirect}
              budgetData={budgetData}
              onError={setMutationError}
              onReload={reloadApresSignature}
              peutEcrireDevis={user.role === 'HEBERGEUR' && sejour?.mesPermissions?.devis === 'WRITE'}
              peutEcrireFacturation={user.role === 'HEBERGEUR' && sejour?.mesPermissions?.facturation === 'WRITE'}
              peutVoirFacturation={user.role === 'HEBERGEUR' && sejour?.mesPermissions?.facturation !== 'NONE'}
            />
            {/* Section Documents officiels (SC5) — après signature, dans le bloc
                Réservation, mêmes conditions d'accès que l'ancien bouton dashboard
                (CONVENTION/SIGNE_DIRECTION). */}
            {navBlocs && devisSigne && (
              <DocumentsOfficiels sejourId={id} onNaviguerOnglet={(t) => selectTab(t as Tab)} />
            )}
          </div>
        )}

        {/* ── Messages ─── */}
        {activeTab === 'messages' && (
          <TabMessages
            sejourId={id}
            user={user}
            isDirect={isDirect}
            invitationCollab={sejour?.invitationCollab ?? null}
            estLectureSeule={estLectureSeule}
            canWrite={canWriteSejour}
          />
        )}

        {/* ── Planning ─── */}
        {activeTab === 'planning' && sejour && (
          <TabPlanning
            sejourId={id}
            sejour={sejour}
            user={user}
            groupes={groupes}
            onError={setMutationError}
          />
        )}

        {/* ── Groupes ─── */}
        {activeTab === 'groupes' && (
          <TabGroupes
            sejourId={id}
            sejour={sejour}
            user={user}
            groupes={groupes}
            participants={participants}
            onGroupesChange={setGroupes}
            onSejourUpdate={(updates) => setSejour(prev => prev ? { ...prev, ...updates } : prev)}
            onReloadSejour={() => { getSejourCollabInfo(id).then(setSejour).catch(() => {}); }}
            onError={setMutationError}
            peutGererEnPropre={(isDirect && sejour?.mesPermissions?.sejours === 'WRITE')}
            peutGererGroupes={user.role === 'HEBERGEUR' && sejour?.mesPermissions?.sejours === 'WRITE'}
          />
        )}

        {/* ── Participants ─── */}
        {activeTab === 'participants' && (
          navBlocs ? (
            /* Bloc Inscriptions (SC4) : choix du mode D14 en tête, sections
               rapatriées de l'ancienne page autorisations, liste existante. */
            <div className="space-y-6">
              {modeInscription === null ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Comment voulez-vous inscrire vos élèves ?</h2>
                  <p className="text-sm text-gray-500 mb-4">Deux façons de faire — vous pourrez gérer toute la liste ici.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModeInscriptionChoisi('FAMILLES')}
                      className="rounded-xl border border-gray-200 p-4 text-left hover:border-[var(--color-border-strong)] hover:bg-[var(--color-primary-light)] transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-900">Je fais remplir par les familles</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Ajoutez vos élèves (à la main ou par CSV), puis envoyez aux parents un lien
                        d&apos;autorisation à signer en ligne — avec suivi des signatures et paiements.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModeInscriptionChoisi('SAISIE')}
                      className="rounded-xl border border-gray-200 p-4 text-left hover:border-[var(--color-border-strong)] hover:bg-[var(--color-primary-light)] transition-colors"
                    >
                      <p className="text-sm font-semibold text-gray-900">Je saisis moi-même la liste</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Remplissez la liste directement (grille de saisie) — vous gérez les
                        autorisations papier de votre côté.
                      </p>
                    </button>
                  </div>
                </div>
              ) : modeInscription === 'FAMILLES' ? (
                <InscriptionsEleves sejourId={id} onChanged={loadParticipants} />
              ) : null}
              <Accompagnateurs
                sejourId={id}
                devisSigne={devisSigne}
                accompagnateurs={accompagnateurs}
                onChanged={loadParticipants}
              />
              <TabParticipantsCollab
                sejour={sejour}
                user={user}
                participants={participants}
                accompagnateurs={accompagnateurs}
                onReload={loadParticipants}
                mode={modeInscription ?? undefined}
              />
            </div>
          ) : (
          <TabParticipantsCollab
            sejour={sejour}
            user={user}
            participants={participants}
            accompagnateurs={accompagnateurs}
            onReload={loadParticipants}
          />
          )
        )}

        {/* ── Chambres (SEJOUR uniquement) : hébergeur = attribution,
               organisateur = rooming. Ternaire EXPLICITE — un rôle imprévu
               ne doit jamais tomber sur TabRooming. ─── */}
        {activeTab === 'chambres' && sejour && (
          user.role === 'HEBERGEUR' ? (
            <TabChambres
              sejourId={id}
              sejour={sejour}
              onError={setMutationError}
              peutGererEnPropre={(isDirect && sejour?.mesPermissions?.sejours === 'WRITE')}
              peutEcrire={user.role === 'HEBERGEUR' && sejour?.mesPermissions?.sejours === 'WRITE'}
            />
          ) : user.role === 'ORGANISATEUR' ? (
            <TabRooming
              sejourId={id}
              sejour={sejour}
              user={user}
              onError={setMutationError}
              onSejourUpdate={(updates) => setSejour(prev => prev ? { ...prev, ...updates } : prev)}
              onReloadSejour={() => { getSejourCollabInfo(id).then(setSejour).catch(() => {}); }}
            />
          ) : null
        )}

        {/* ── Journal ─── */}
        {activeTab === 'journal' && (
          <TabJournal
            sejourId={id}
            user={user}
            isDirect={isDirect}
            invitationCollab={sejour?.invitationCollab ?? null}
            estLectureSeule={estLectureSeule}
            onError={setMutationError}
            canWrite={canWriteSejour}
          />
        )}

        {/* ── Documents ─── */}
        {activeTab === 'documents' && (
          <TabDocuments
            sejourId={id}
            isDirector={isDirector}
            estLectureSeule={estLectureSeule}
            onError={setMutationError}
            canWrite={canWriteSejour}
          />
        )}

        {/* ── Budget prévisionnel ─── */}
        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Bloc Budget (SC4) : prix par élève + date limite rapatriés de
                l'ancienne page autorisations, pour l'organisateur créateur. */}
            {navBlocs && sejour && (
              <PrixParEleve
                sejourId={id}
                sejour={sejour}
                devis={budgetData?.devis ?? null}
                nbInscrits={participants.length}
                onSaved={() => { getSejourCollabInfo(id).then(setSejour).catch(() => {}); }}
              />
            )}
            <TabBudget
              sejourId={id}
              user={user}
              budgetData={budgetData}
              budgetLoading={budgetLoading}
              onReload={loadBudget}
              onError={setMutationError}
            />
          </div>
        )}
        {/* ── Projet pédagogique ─── */}
        {activeTab === 'projet' && user.role === 'ORGANISATEUR' && (
          <div className="space-y-6">
            {/* Section thématiques : le bandeau global est déplacé ici pour
                l'organisateur créateur (SC3) — même JSX, jamais dupliqué. */}
            {navBlocs && bandeauThematiques}
            <TabProjetPedagogique sejourId={id} />
          </div>
        )}
        {/* ── Notes & suivi (tous modes / natures, hébergeur seul) ─── */}
        {activeTab === 'notes' && sejour && (
          <TabNotes
            sejourId={id}
            initialNotes={sejour.notesInternes ?? ''}
            onError={setMutationError}
            canWrite={(sejour.mesPermissions?.crm === 'WRITE')}
          />
        )}

      </main>
    </div>
  );
}
