'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  MessageCollab,
  PlanningActivite,
  DocumentSejour,
  TypeDocumentSejour,
} from '@/src/lib/collaboration';

// ─── Onglets ────────────────────────────────────────────────────────────────

type Tab = 'messages' | 'planning' | 'documents';

const TABS: { key: Tab; label: string }[] = [
  { key: 'messages', label: 'Messages' },
  { key: 'planning', label: 'Planning' },
  { key: 'documents', label: 'Documents' },
];

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
  ASSURANCE: 'bg-green-100 text-green-700',
  FACTURE: 'bg-purple-100 text-purple-700',
  AUTRE: 'bg-gray-100 text-gray-600',
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
  const [docForm, setDocForm] = useState({ nom: '', type: 'AUTRE' as TypeDocumentSejour, url: '' });

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

  useEffect(() => {
    if (tab === 'messages') loadMessages();
    if (tab === 'planning') loadPlanning();
    if (tab === 'documents') loadDocs();
  }, [tab, loadMessages, loadPlanning, loadDocs]);

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

  const handleAddDocument = async () => {
    if (!id || !docForm.nom || !docForm.url) return;
    try {
      const doc = await createDocument(id, docForm);
      setDocs((prev) => [doc, ...prev]);
      setDocForm({ nom: '', type: 'AUTRE', url: '' });
    } catch { /* ignore */ }
  };

  // ── Loading / Error ──
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
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
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={retourHref} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                &larr; Retour
              </Link>
              {sejour && (
                <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                  {sejour.titre}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-600'
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
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}>
                      {!isOwn && (
                        <p className="text-xs font-semibold text-gray-500 mb-0.5">
                          {m.auteur.prenom} {m.auteur.nom}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.contenu}</p>
                      <p className={`text-[10px] mt-1 ${isOwn ? 'text-indigo-200' : 'text-gray-400'}`}>
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
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !msgInput.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* ── Planning ─── */}
        {tab === 'planning' && (
          <div className="space-y-6">
            {/* Formulaire inline */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter une activité</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="date" value={planForm.date} onChange={(e) => setPlanForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Date" />
                <input type="time" value={planForm.heureDebut} onChange={(e) => setPlanForm((f) => ({ ...f, heureDebut: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="time" value={planForm.heureFin} onChange={(e) => setPlanForm((f) => ({ ...f, heureFin: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <input type="text" value={planForm.titre} onChange={(e) => setPlanForm((f) => ({ ...f, titre: e.target.value }))}
                  placeholder="Titre de l'activité" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" value={planForm.description} onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description (optionnel)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="text" value={planForm.responsable} onChange={(e) => setPlanForm((f) => ({ ...f, responsable: e.target.value }))}
                  placeholder="Responsable (optionnel)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={handleAddPlanning}
                disabled={!planForm.date || !planForm.heureDebut || !planForm.heureFin || !planForm.titre}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Ajouter
              </button>
            </div>

            {/* Liste par jour */}
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
                          <span className="text-xs font-mono text-indigo-600">{p.heureDebut} - {p.heureFin}</span>
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

        {/* ── Documents ─── */}
        {tab === 'documents' && (
          <div className="space-y-6">
            {/* Formulaire */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ajouter un document</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input type="text" value={docForm.nom} onChange={(e) => setDocForm((f) => ({ ...f, nom: e.target.value }))}
                  placeholder="Nom du document" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <select value={docForm.type} onChange={(e) => setDocForm((f) => ({ ...f, type: e.target.value as TypeDocumentSejour }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TYPE_DOC_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input type="url" value={docForm.url} onChange={(e) => setDocForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="URL du document" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <button onClick={handleAddDocument}
                disabled={!docForm.nom || !docForm.url}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Ajouter
              </button>
            </div>

            {/* Liste */}
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
                    className="shrink-0 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    Télécharger
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
