'use client';

import { useEffect, useState, useRef, useCallback, type DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getSejourCollabInfo,
  getMessages,
  sendMessage,
  getPlanning,
  createPlanning,
  deletePlanning,
  getDocuments,
  createDocument,
  getParticipants,
  getBudgetData,
  getDocumentsCentre,
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  MessageCollab,
  PlanningActivite,
  DocumentSejour,
  TypeDocumentSejour,
  Participant,
  BudgetData,
  DocumentCentreFiche,
} from '@/src/lib/collaboration';
import {
  getAccompagnateursBySejour,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';

// ─── Onglets ────────────────────────────────────────────────────────────────

type Tab = 'messages' | 'planning' | 'participants' | 'documents' | 'budget';

const TABS: { key: Tab; label: string }[] = [
  { key: 'messages', label: 'Messages' },
  { key: 'planning', label: 'Planning' },
  { key: 'participants', label: 'Participants' },
  { key: 'documents', label: 'Documents' },
  { key: 'budget', label: 'Budget prévisionnel' },
];

const CATEGORIES_COMPL = ['Transport', 'Assurance', 'Visites et activités', 'Restauration hors forfait', 'Autre'];
const SOURCES_RECETTES = ['Participation familles', 'Subvention collectivité', 'FSE / MDL', 'Ressources établissement', 'Don association', 'Autre'];

const TYPE_DOC_OPTIONS: { value: TypeDocumentSejour; label: string }[] = [
  { value: 'PROGRAMME', label: 'Programme' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ASSURANCE', label: 'Assurance' },
  { value: 'FACTURE', label: 'Facture' },
  { value: 'AUTRE', label: 'Autre' },
];

const TYPE_DOC_BADGE: Record<TypeDocumentSejour, string> = {
  PROGRAMME: 'bg-blue-100 text-blue-700',
  TRANSPORT: 'bg-orange-100 text-orange-700',
  ASSURANCE: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  FACTURE: 'bg-purple-100 text-purple-700',
  AUTRE: 'bg-gray-100 text-gray-600',
};

const NIVEAU_SKI_LABEL: Record<string, string> = {
  DEBUTANT: 'Débutant',
  INTERMEDIAIRE: 'Intermédiaire',
  CONFIRME: 'Confirmé',
  HORS_PISTE: 'Hors-piste',
};

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);
  const [tab, setTab] = useState<Tab>('messages');
  const [error, setError] = useState<string | null>(null);

  // Messages
  const [messages, setMessages] = useState<MessageCollab[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Planning
  const [planning, setPlanning] = useState<PlanningActivite[]>([]);
  const [planForm, setPlanForm] = useState({ date: '', heureDebut: '', heureFin: '', titre: '', description: '', responsable: '' });

  // Documents
  const [docs, setDocs] = useState<DocumentSejour[]>([]);
  const [docsCentre, setDocsCentre] = useState<DocumentCentreFiche[]>([]);
  const [docForm, setDocForm] = useState({ nom: '', type: 'AUTRE' as TypeDocumentSejour });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docDragging, setDocDragging] = useState(false);
  const [docSending, setDocSending] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantFilter, setParticipantFilter] = useState<'all' | 'signed' | 'pending'>('all');

  // Accompagnateurs
  const [accompagnateurs, setAccompagnateurs] = useState<AccompagnateurMission[]>([]);

  // Budget
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [lignesCompl, setLignesCompl] = useState<{ id: string; categorie: string; description: string; montant: number }[]>([]);
  const [ligneComplForm, setLigneComplForm] = useState({ categorie: 'Transport', description: '', montant: '' });
  const [recettes, setRecettes] = useState<{ id: string; source: string; montant: number }[]>([]);
  const [recetteForm, setRecetteForm] = useState({ source: 'Participation familles', montant: '' });

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== 'TEACHER' && user.role !== 'VENUE'))) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // ── Load séjour info ──
  useEffect(() => {
    if (!id || !user) return;
    getSejourCollabInfo(id).then(setSejour).catch(() => setError('Impossible de charger les informations du séjour.'));
  }, [id, user]);

  // ── Load tab data ──
  const loadMessages = useCallback(async () => {
    if (!id) return;
    try { setMessages(await getMessages(id)); } catch { /* ignore */ }
  }, [id]);

  const loadPlanning = useCallback(async () => {
    if (!id) return;
    try { setPlanning(await getPlanning(id)); } catch { /* ignore */ }
  }, [id]);

  const loadDocs = useCallback(async () => {
    if (!id) return;
    try { setDocs(await getDocuments(id)); } catch { /* ignore */ }
  }, [id]);

  const loadDocsCentre = useCallback(async () => {
    if (!id) return;
    try { setDocsCentre(await getDocumentsCentre(id)); } catch { /* ignore */ }
  }, [id]);

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
    try { setBudgetData(await getBudgetData(id)); } catch { /* ignore */ }
    finally { setBudgetLoading(false); }
  }, [id]);

  useEffect(() => {
    if (tab === 'messages') loadMessages();
    if (tab === 'planning') loadPlanning();
    if (tab === 'documents') { loadDocs(); loadDocsCentre(); }
    if (tab === 'participants') loadParticipants();
    if (tab === 'budget') loadBudget();
  }, [tab, loadMessages, loadPlanning, loadDocs, loadDocsCentre, loadParticipants, loadBudget]);

  // ── Polling messages 10s ──
  useEffect(() => {
    if (tab !== 'messages') return;
    const iv = setInterval(loadMessages, 10_000);
    return () => clearInterval(iv);
  }, [tab, loadMessages]);

  // ── Auto-scroll ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handlers ──
  const handleSendMessage = async () => {
    if (!id || !msgInput.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(id, msgInput.trim());
      setMessages((prev) => [...prev, msg]);
      setMsgInput('');
    } catch { /* ignore */ }
    setSending(false);
  };

  const handleAddPlanning = async () => {
    if (!id || !planForm.date || !planForm.heureDebut || !planForm.heureFin || !planForm.titre) return;
    try {
      const item = await createPlanning(id, {
        date: planForm.date,
        heureDebut: planForm.heureDebut,
        heureFin: planForm.heureFin,
        titre: planForm.titre,
        description: planForm.description || undefined,
        responsable: planForm.responsable || undefined,
      });
      setPlanning((prev) => [...prev, item].sort((a, b) => a.date.localeCompare(b.date) || a.heureDebut.localeCompare(b.heureDebut)));
      setPlanForm({ date: '', heureDebut: '', heureFin: '', titre: '', description: '', responsable: '' });
    } catch { /* ignore */ }
  };

  const handleDeletePlanning = async (planningId: string) => {
    if (!id) return;
    try {
      await deletePlanning(id, planningId);
      setPlanning((prev) => prev.filter((p) => p.id !== planningId));
    } catch { /* ignore */ }
  };

  const handleDocFileSelect = (file: File | undefined) => {
    if (!file) return;
    const allowed = [
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg',
    ];
    if (allowed.includes(file.type)) {
      setDocFile(file);
      if (!docForm.nom) {
        setDocForm((f) => ({ ...f, nom: file.name.replace(/\.[^.]+$/, '') }));
      }
    }
  };

  const handleDocDrop = (e: DragEvent) => {
    e.preventDefault();
    setDocDragging(false);
    handleDocFileSelect(e.dataTransfer.files[0]);
  };

  const handleAddDocument = async () => {
    if (!id || !docForm.nom || !docFile) return;
    setDocSending(true);
    try {
      const doc = await createDocument(id, { nom: docForm.nom, type: docForm.type }, docFile);
      setDocs((prev) => [doc, ...prev]);
      setDocForm({ nom: '', type: 'AUTRE' });
      setDocFile(null);
    } catch { /* ignore */ }
    setDocSending(false);
  };

  // ── CSV Export ──
  const exportCSV = () => {
    const headers = ['Prénom', 'Nom', 'Statut', 'Taille (cm)', 'Poids (kg)', 'Pointure', 'Régime alimentaire', 'Niveau ski', 'Infos médicales'];
    const rows = participants.map((p) => [
      p.elevePrenom,
      p.eleveNom,
      p.signeeAt ? 'Signée' : 'En attente',
      p.taille?.toString() ?? '',
      p.poids?.toString() ?? '',
      p.pointure?.toString() ?? '',
      p.regimeAlimentaire ?? '',
      p.niveauSki ? (NIVEAU_SKI_LABEL[p.niveauSki] ?? p.niveauSki) : '',
      p.infosMedicales ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `participants-${sejour?.titre ?? 'sejour'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filter participants ──
  const filteredParticipants = participants.filter((p) => {
    if (participantFilter === 'signed') return !!p.signeeAt;
    if (participantFilter === 'pending') return !p.signeeAt;
    return true;
  });

  const signedCount = participants.filter((p) => p.signeeAt).length;

  // Check if ski column relevant
  const showSkiColumn = participants.some((p) => p.niveauSki);

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

  const retourHref = user.role === 'TEACHER' ? '/dashboard/teacher' : '/dashboard/venue';

  // ── Group planning by day ──
  const planningByDay = planning.reduce<Record<string, PlanningActivite[]>>((acc, p) => {
    const day = p.date.slice(0, 10);
    (acc[day] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={retourHref} className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium">
                &larr; Retour
              </Link>
              {sejour && (
                <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                  {sejour.titre}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                Convention
              </span>
            </div>
            {sejour && (
              <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500">
                {sejour.createur && <span>Enseignant : {sejour.createur.prenom} {sejour.createur.nom}</span>}
                {sejour.hebergementSelectionne && <span>Centre : {sejour.hebergementSelectionne.nom} ({sejour.hebergementSelectionne.ville})</span>}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ── Messages ─── */}
        {tab === 'messages' && (
          <div className="flex flex-col h-[calc(100vh-220px)]">
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-12">Aucun message pour l&apos;instant. Lancez la conversation !</p>
              )}
              {messages.map((m) => {
                const isOwn = m.auteurId === user.id;
                return (
                  <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? 'bg-[var(--color-primary)] text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}>
                      {!isOwn && (
                        <p className="text-xs font-semibold text-gray-500 mb-0.5">
                          {m.auteur.prenom} {m.auteur.nom}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.contenu}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? 'text-[var(--color-primary-light)]' : 'text-gray-400'}`}>
                        {new Date(m.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-200">
              <input
                type="text"
                value={msgInput}
                onChange={(e) => setMsgInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Votre message..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-border-strong)]"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !msgInput.trim()}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* ── Planning ─── */}
        {tab === 'planning' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter une activité</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="date" value={planForm.date} onChange={(e) => setPlanForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" placeholder="Date" />
                <input type="time" value={planForm.heureDebut} onChange={(e) => setPlanForm((f) => ({ ...f, heureDebut: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="time" value={planForm.heureFin} onChange={(e) => setPlanForm((f) => ({ ...f, heureFin: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <input type="text" value={planForm.titre} onChange={(e) => setPlanForm((f) => ({ ...f, titre: e.target.value }))}
                  placeholder="Titre de l'activité" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={planForm.description} onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optionnel)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <input type="text" value={planForm.responsable} onChange={(e) => setPlanForm((f) => ({ ...f, responsable: e.target.value }))}
                  placeholder="Responsable (optionnel)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <button onClick={handleAddPlanning}
                disabled={!planForm.date || !planForm.heureDebut || !planForm.heureFin || !planForm.titre}
                className="mt-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Ajouter
              </button>
            </div>

            {Object.keys(planningByDay).length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">Aucune activité planifiée.</p>
            )}
            {Object.entries(planningByDay)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, items]) => (
                <div key={day}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                        <div>
                          <span className="text-xs font-mono text-[var(--color-primary)]">{p.heureDebut} - {p.heureFin}</span>
                          <span className="ml-3 text-sm font-medium text-gray-900">{p.titre}</span>
                          {p.description && <span className="ml-2 text-xs text-gray-500">— {p.description}</span>}
                          {p.responsable && <span className="ml-2 text-xs text-gray-400">({p.responsable})</span>}
                        </div>
                        <button onClick={() => handleDeletePlanning(p.id)} className="text-red-400 hover:text-red-600 text-xs">
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* ── Participants ─── */}
        {tab === 'participants' && (
          <div className="space-y-4">
            {/* Header + actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-900">
                  {signedCount}/{participants.length} autorisations signées
                </span>
                <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-success)] rounded-full transition-all"
                    style={{ width: participants.length ? `${(signedCount / participants.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Filtres */}
                {(['all', 'signed', 'pending'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setParticipantFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      participantFilter === f
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? 'Tous' : f === 'signed' ? 'Signés' : 'En attente'}
                  </button>
                ))}
                <button
                  onClick={exportCSV}
                  disabled={participants.length === 0}
                  className="rounded-lg bg-white border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* Tableau */}
            {filteredParticipants.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">
                {participants.length === 0 ? 'Aucun participant enregistré.' : 'Aucun résultat pour ce filtre.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Élève</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Statut</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-700">Taille</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-700">Poids</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-700">Pointure</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Régime</th>
                      {showSkiColumn && (
                        <th className="text-left py-3 px-3 font-semibold text-gray-700">Ski</th>
                      )}
                      <th className="text-center py-3 px-3 font-semibold text-gray-700">Médical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-3">
                          <p className="font-medium text-gray-900">{p.elevePrenom} {p.eleveNom}</p>
                        </td>
                        <td className="py-3 px-3">
                          {p.signeeAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                              Signée
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                              En attente
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-gray-600">
                          {p.taille ? `${p.taille} cm` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center text-gray-600">
                          {p.poids ? `${p.poids} kg` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center text-gray-600">
                          {p.pointure ?? '—'}
                        </td>
                        <td className="py-3 px-3 text-gray-600">
                          {p.regimeAlimentaire ?? '—'}
                        </td>
                        {showSkiColumn && (
                          <td className="py-3 px-3 text-gray-600">
                            {p.niveauSki ? (NIVEAU_SKI_LABEL[p.niveauSki] ?? p.niveauSki) : '—'}
                          </td>
                        )}
                        <td className="py-3 px-3 text-center">
                          {p.infosMedicales ? (
                            <span className="relative group cursor-help">
                              <span className="text-base" title={p.infosMedicales}>&#127973;</span>
                              <span className="invisible group-hover:visible absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 rounded-lg bg-gray-900 text-white text-xs p-3 shadow-lg">
                                {p.infosMedicales}
                                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Accompagnateurs */}
            {accompagnateurs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  Accompagnateurs ({accompagnateurs.length})
                </h3>
                <div className="space-y-2">
                  {accompagnateurs.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{a.prenom} {a.nom}</span>
                          {a.signeeAt ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                              Signé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                              En attente
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{a.email}{a.telephone ? ` — ${a.telephone}` : ''}</p>
                      </div>
                      {a.contactUrgenceNom && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-gray-400">Contact urgence</p>
                          <p className="text-xs text-gray-600">{a.contactUrgenceNom}{a.contactUrgenceTel ? ` — ${a.contactUrgenceTel}` : ''}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Documents ─── */}
        {tab === 'documents' && (
          <div className="space-y-6">
            {docsCentre.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents du centre partenaire</h3>
                <div className="space-y-2">
                  {docsCentre.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{d.nom}</p>
                        <p className="text-xs text-gray-500">
                          {d.type}
                          {d.dateExpiration && ` — Expire le ${new Date(d.dateExpiration).toLocaleDateString('fr-FR')}`}
                        </p>
                      </div>
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs font-medium text-[var(--color-primary)] hover:underline shrink-0">
                          Télécharger
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter un document</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input type="text" value={docForm.nom} onChange={(e) => setDocForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom du document" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value as TypeDocumentSejour }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                  {TYPE_DOC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Zone drag & drop */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDocDragging(true); }}
                onDragLeave={() => setDocDragging(false)}
                onDrop={handleDocDrop}
                className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  docDragging
                    ? 'border-indigo-400 bg-[var(--color-primary-light)]'
                    : docFile
                      ? 'border-[var(--color-success)] bg-[var(--color-success-light)]'
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                {docFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="h-8 w-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{docFile.name}</p>
                      <p className="text-xs text-gray-500">{(docFile.size / 1024).toFixed(0)} Ko</p>
                    </div>
                    <button onClick={() => setDocFile(null)} className="ml-2 text-gray-400 hover:text-red-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-1">Glissez-déposez votre fichier ici</p>
                    <p className="text-xs text-gray-400 mb-3">ou</p>
                    <button
                      type="button"
                      onClick={() => docFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                      </svg>
                      Parcourir
                    </button>
                    <input
                      ref={docFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => handleDocFileSelect(e.target.files?.[0])}
                    />
                    <p className="mt-3 text-xs text-gray-400">PDF, Word, Excel, PowerPoint, PNG, JPG</p>
                  </>
                )}
              </div>

              <button onClick={handleAddDocument}
                disabled={!docForm.nom || !docFile || docSending}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {docSending ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Ajouter
                  </>
                )}
              </button>
            </div>

            {docs.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8">Aucun document partagé.</p>
            )}
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_DOC_BADGE[d.type]}`}>
                      {TYPE_DOC_OPTIONS.find((o) => o.value === d.type)?.label ?? d.type}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{d.nom}</span>
                    <span className="text-xs text-gray-400">par {d.uploader.prenom} {d.uploader.nom}</span>
                  </div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium">
                    Télécharger
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── Budget prévisionnel ─── */}
        {tab === 'budget' && (
          <div className="space-y-6">
            {budgetLoading && (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!budgetLoading && budgetData && (() => {
              const s = budgetData.sejour;
              const d = budgetData.devis;
              const isTeacher = user.role === 'TEACHER';

              const totalHebergeur = d?.montantTTC ?? 0;
              const totalCompl = lignesCompl.reduce((sum, l) => sum + l.montant, 0);
              const totalDepenses = totalHebergeur + totalCompl;
              const totalRecettes = recettes.reduce((sum, r) => sum + r.montant, 0);
              const solde = totalRecettes - totalDepenses;

              const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

              const handleAddLigneCompl = () => {
                const montant = parseFloat(ligneComplForm.montant);
                if (!ligneComplForm.description.trim() || isNaN(montant) || montant <= 0) return;
                setLignesCompl((prev) => [...prev, { id: crypto.randomUUID(), categorie: ligneComplForm.categorie, description: ligneComplForm.description.trim(), montant }]);
                setLigneComplForm((f) => ({ ...f, description: '', montant: '' }));
              };

              const handleAddRecette = () => {
                const montant = parseFloat(recetteForm.montant);
                if (isNaN(montant) || montant <= 0) return;
                setRecettes((prev) => [...prev, { id: crypto.randomUUID(), source: recetteForm.source, montant }]);
                setRecetteForm((f) => ({ ...f, montant: '' }));
              };

              const inputCls = 'rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

              return (
                <>
                  {/* SECTION 1 — En-tête */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Budget prévisionnel — {s?.titre}</h2>
                        {s?.createur && (
                          <div className="mt-2 text-sm text-gray-600 space-y-0.5">
                            {s.createur.etablissementNom && (
                              <p>{s.createur.etablissementNom}{s.createur.etablissementUai ? ` (UAI : ${s.createur.etablissementUai})` : ''}</p>
                            )}
                            <p>Enseignant : {s.createur.prenom} {s.createur.nom}</p>
                          </div>
                        )}
                        {s && (
                          <p className="mt-1 text-sm text-gray-500">
                            Du {fmtDate(s.dateDebut)} au {fmtDate(s.dateFin)} — {s.placesTotales} élèves
                          </p>
                        )}
                      </div>
                      {isTeacher && (
                        <button
                          onClick={() => window.print()}
                          className="print:hidden rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors"
                        >
                          Imprimer / Exporter PDF
                        </button>
                      )}
                    </div>
                  </div>

                  {/* SECTION 2 — Prestations hébergeur */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      Prestations hébergeur{d?.centre ? ` — ${d.centre.nom}` : ''}
                    </h3>
                    {!d ? (
                      <p className="text-sm text-gray-400 py-4 text-center">Aucun devis sélectionné pour ce séjour.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">Qté</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">Prix unit. HT</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">TVA</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">Total TTC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.lignes.map((l) => (
                              <tr key={l.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{l.description}</td>
                                <td className="py-2 px-3 text-right text-gray-600">{l.quantite}</td>
                                <td className="py-2 px-3 text-right text-gray-600">{fmt(l.prixUnitaire)} &euro;</td>
                                <td className="py-2 px-3 text-right text-gray-600">{l.tva} %</td>
                                <td className="py-2 px-3 text-right text-gray-900 font-medium">{fmt(l.totalTTC)} &euro;</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300">
                              <td colSpan={4} className="py-3 px-3 text-right font-semibold text-gray-900">Total prestations hébergeur</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">{fmt(totalHebergeur)} &euro;</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* SECTION 3 — Dépenses complémentaires */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Dépenses complémentaires</h3>

                    {lignesCompl.length > 0 && (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Catégorie</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Description</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">Montant</th>
                              {isTeacher && <th className="w-10" />}
                            </tr>
                          </thead>
                          <tbody>
                            {lignesCompl.map((l) => (
                              <tr key={l.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-600">{l.categorie}</td>
                                <td className="py-2 px-3 text-gray-900">{l.description}</td>
                                <td className="py-2 px-3 text-right text-gray-900 font-medium">{fmt(l.montant)} &euro;</td>
                                {isTeacher && (
                                  <td className="py-2 px-1">
                                    <button onClick={() => setLignesCompl((prev) => prev.filter((x) => x.id !== l.id))} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300">
                              <td colSpan={2} className="py-3 px-3 text-right font-semibold text-gray-900">Total complémentaires</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">{fmt(totalCompl)} &euro;</td>
                              {isTeacher && <td />}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {lignesCompl.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3 mb-4">Aucune dépense complémentaire.</p>
                    )}

                    {isTeacher && (
                      <div className="print:hidden flex flex-col sm:flex-row gap-3">
                        <select value={ligneComplForm.categorie} onChange={(e) => setLigneComplForm((f) => ({ ...f, categorie: e.target.value }))} className={inputCls}>
                          {CATEGORIES_COMPL.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="text" value={ligneComplForm.description} onChange={(e) => setLigneComplForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Description" className={`flex-1 ${inputCls}`} />
                        <input type="number" value={ligneComplForm.montant} onChange={(e) => setLigneComplForm((f) => ({ ...f, montant: e.target.value }))}
                          placeholder="Montant" min={0} step={0.01} className={`w-32 ${inputCls}`} />
                        <button onClick={handleAddLigneCompl}
                          disabled={!ligneComplForm.description.trim() || !ligneComplForm.montant}
                          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          Ajouter
                        </button>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total général dépenses</p>
                        <p className="text-xl font-bold text-gray-900">{fmt(totalDepenses)} &euro;</p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4 — Recettes */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Recettes</h3>

                    {recettes.length > 0 && (
                      <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Source</th>
                              <th className="text-right py-2 px-3 font-semibold text-gray-700">Montant</th>
                              {isTeacher && <th className="w-10" />}
                            </tr>
                          </thead>
                          <tbody>
                            {recettes.map((r) => (
                              <tr key={r.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{r.source}</td>
                                <td className="py-2 px-3 text-right text-gray-900 font-medium">{fmt(r.montant)} &euro;</td>
                                {isTeacher && (
                                  <td className="py-2 px-1">
                                    <button onClick={() => setRecettes((prev) => prev.filter((x) => x.id !== r.id))} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-300">
                              <td className="py-3 px-3 text-right font-semibold text-gray-900">Total recettes</td>
                              <td className="py-3 px-3 text-right font-bold text-gray-900">{fmt(totalRecettes)} &euro;</td>
                              {isTeacher && <td />}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}

                    {recettes.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-3 mb-4">Aucune recette saisie.</p>
                    )}

                    {isTeacher && (
                      <div className="print:hidden flex flex-col sm:flex-row gap-3">
                        <select value={recetteForm.source} onChange={(e) => setRecetteForm((f) => ({ ...f, source: e.target.value }))} className={inputCls}>
                          {SOURCES_RECETTES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input type="number" value={recetteForm.montant} onChange={(e) => setRecetteForm((f) => ({ ...f, montant: e.target.value }))}
                          placeholder="Montant" min={0} step={0.01} className={`w-40 ${inputCls}`} />
                        <button onClick={handleAddRecette}
                          disabled={!recetteForm.montant}
                          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          Ajouter
                        </button>
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Solde (Recettes - Dépenses)</p>
                        <p className={`text-xl font-bold ${solde >= 0 ? 'text-[var(--color-success)]' : 'text-red-600'}`}>
                          {solde >= 0 ? '+' : ''}{fmt(solde)} &euro;
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
