'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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


// ─── Page ───────────────────────────────────────────────────────────────────

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);
  const isDirect = sejour?.modeGestion === 'DIRECT';
  const isEvenement = sejour?.natureSejour === 'EVENEMENT';
  const [tab, setTab] = useState<Tab>('devis');
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // ── Tracking visite onglet (notifications hébergeur) ────────
  useEffect(() => {
    const ONGLETS_TRACKING = ['messages', 'documents', 'journal'];
    if (!user || user.role !== 'HEBERGEUR' || !id || !ONGLETS_TRACKING.includes(tab)) return;
    marquerVisite(id, tab).catch(() => {});
  }, [tab, user, id]);

  // Groupes (partagé avec l'onglet planning — export PDF)
  const [groupes, setGroupes] = useState<GroupeSejour[]>([]);

  // Participants (partagé : onglets participants + groupes)
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Accompagnateurs
  const [accompagnateurs, setAccompagnateurs] = useState<AccompagnateurMission[]>([]);
  const monRoleCollaboratif = useMemo(() => {
    if (!user || !accompagnateurs) return null;
    const moi = accompagnateurs.find((a) => a.userId === user.id && a.accesCollaboratif);
    return moi?.roleCollaboratif ?? null;
  }, [user, accompagnateurs]);
  const estLectureSeule = monRoleCollaboratif === 'LECTURE';
  const estAccompagnateur = monRoleCollaboratif !== null && sejour?.createur?.id !== user?.id;
  const ACCOMPAGNATEUR_TABS: Tab[] = ['planning', 'participants', 'groupes', 'journal'];

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

  useEffect(() => {
    if (estAccompagnateur && !ACCOMPAGNATEUR_TABS.includes(tab)) {
      setTab('planning');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estAccompagnateur, tab]);

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

  useEffect(() => {
    if (tab === 'devis' && !isDirect) loadBudget();
    if (tab === 'groupes') {
      getGroupes(id).then(setGroupes).catch(() => {});
      loadParticipants();
    }
    if (tab === 'participants') loadParticipants();
    if (tab === 'budget') loadBudget();
  }, [tab, isDirect, id, loadParticipants, loadBudget]);

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

      {/* ── Bandeau thématiques manquantes ─────────────────────────────────── */}
      {user.role === 'ORGANISATEUR' && sejour && (!sejour.thematiquesPedagogiques || sejour.thematiquesPedagogiques.length === 0) && (
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
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* overflow-x-auto : sur mobile les onglets débordent et doivent rester atteignables */}
          <div className="flex gap-6 overflow-x-auto">
            {TABS.filter((t) =>
              estAccompagnateur
                ? ACCOMPAGNATEUR_TABS.includes(t.key)
                : (
                  (t.key !== 'projet' || user.role === 'ORGANISATEUR') &&
                  (t.key !== 'budget' || user.role === 'ORGANISATEUR' || isDirector) &&
                  (t.key !== 'groupes' || user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') &&
                  (t.key !== 'journal' || user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') &&
                  (t.key !== 'notes' || user.role === 'HEBERGEUR') &&
                  (t.key !== 'chambres' || user.role === 'HEBERGEUR' || user.role === 'ORGANISATEUR')
                )
            )
            .filter((t) => {
              // Journal masqué pour tout EVENEMENT (quel que soit le mode de gestion).
              if (isEvenement && (t.key === 'groupes' || t.key === 'projet' || t.key === 'participants' || t.key === 'journal' || t.key === 'chambres')) return false;
              if (isDirect && (t.key === 'budget' || t.key === 'projet')) return false;
              return true;
            })
            .map((t) => {
              const label = t.key === 'planning' && isEvenement ? 'Programme' : t.label;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 whitespace-nowrap py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
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

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Devis & facturation (DIRECT + COLLABORATIF) ─── */}
        {tab === 'devis' && sejour && (
          <TabDevisFacturation
            sejourId={id}
            sejour={sejour}
            user={user}
            isDirect={isDirect}
            budgetData={budgetData}
            onError={setMutationError}
          />
        )}

        {/* ── Messages ─── */}
        {tab === 'messages' && (
          <TabMessages
            sejourId={id}
            user={user}
            isDirect={isDirect}
            invitationCollab={sejour?.invitationCollab ?? null}
            estLectureSeule={estLectureSeule}
          />
        )}

        {/* ── Planning ─── */}
        {tab === 'planning' && sejour && (
          <TabPlanning
            sejourId={id}
            sejour={sejour}
            user={user}
            groupes={groupes}
            onError={setMutationError}
          />
        )}

        {/* ── Groupes ─── */}
        {tab === 'groupes' && (
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
          />
        )}

        {/* ── Participants ─── */}
        {tab === 'participants' && (
          <TabParticipantsCollab
            sejour={sejour}
            user={user}
            participants={participants}
            accompagnateurs={accompagnateurs}
            onReload={loadParticipants}
          />
        )}

        {/* ── Chambres (SEJOUR uniquement) : hébergeur = attribution,
               organisateur = rooming. Ternaire EXPLICITE — un rôle imprévu
               ne doit jamais tomber sur TabRooming. ─── */}
        {tab === 'chambres' && sejour && (
          user.role === 'HEBERGEUR' ? (
            <TabChambres
              sejourId={id}
              sejour={sejour}
              onError={setMutationError}
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
        {tab === 'journal' && (
          <TabJournal
            sejourId={id}
            user={user}
            isDirect={isDirect}
            invitationCollab={sejour?.invitationCollab ?? null}
            estLectureSeule={estLectureSeule}
            onError={setMutationError}
          />
        )}

        {/* ── Documents ─── */}
        {tab === 'documents' && (
          <TabDocuments
            sejourId={id}
            isDirector={isDirector}
            estLectureSeule={estLectureSeule}
            onError={setMutationError}
          />
        )}

        {/* ── Budget prévisionnel ─── */}
        {tab === 'budget' && (
          <TabBudget
            sejourId={id}
            user={user}
            budgetData={budgetData}
            budgetLoading={budgetLoading}
            onReload={loadBudget}
            onError={setError}
          />
        )}
        {/* ── Projet pédagogique ─── */}
        {tab === 'projet' && user.role === 'ORGANISATEUR' && (
          <TabProjetPedagogique sejourId={id} />
        )}
        {/* ── Notes & suivi (tous modes / natures, hébergeur seul) ─── */}
        {tab === 'notes' && sejour && (
          <TabNotes
            sejourId={id}
            initialNotes={sejour.notesInternes ?? ''}
            onError={setMutationError}
          />
        )}

      </main>
    </div>
  );
}
