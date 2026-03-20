'use client';

import React from 'react';
import { useEffect, useState, useRef, useCallback, type DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
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
  addLigneCompl,
  deleteLigneCompl,
  addRecetteBudget,
  deleteRecetteBudget,
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
  LigneCompl,
  RecetteBudget,
} from '@/src/lib/collaboration';
import {
  getAccompagnateursBySejour,
  getOrdreMissionHtml,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';
import { getDossierPedagogique } from '@/src/lib/sejour';
import type { DossierPedagogiqueData } from '@/src/lib/sejour';

// ─── Onglets ────────────────────────────────────────────────────────────────

type Tab = 'devis' | 'messages' | 'planning' | 'participants' | 'documents' | 'budget' | 'projet';

const TABS: { key: Tab; label: string }[] = [
  { key: 'devis', label: 'Devis' },
  { key: 'messages', label: 'Messages' },
  { key: 'planning', label: 'Planning' },
  { key: 'participants', label: 'Participants' },
  { key: 'documents', label: 'Documents' },
  { key: 'budget', label: 'Budget prévisionnel' },
  { key: 'projet', label: 'Projet pédagogique' },
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

// ─── DroppableDay ────────────────────────────────────────────────────────────
function DroppableDay({
  dayIdx, dateStr, isVenue, slots, slotHeight, onCellClick, children
}: {
  dayIdx: number;
  dateStr: string;
  isVenue: boolean;
  slots: number;
  slotHeight: number;
  onCellClick: (slotIdx: number) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: `day-${dateStr}` });
  return (
    <div ref={setNodeRef} className="flex-1 border-l border-gray-200 relative" style={{ minWidth: 120 }}>
      {Array.from({ length: slots }).map((_, slotIdx) => (
        <div
          key={slotIdx}
          style={{ height: `${slotHeight}px`, top: `${slotIdx * slotHeight}px` }}
          className={`absolute w-full border-b ${slotIdx % 2 === 0 ? 'border-gray-100' : 'border-gray-50'} ${isVenue ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}
          onClick={() => isVenue && onCellClick(slotIdx)}
        />
      ))}
      {children}
    </div>
  );
}

// ─── DraggableActivity ───────────────────────────────────────────────────────
function DraggableActivity({
  act, topPx, heightPx, isVenue, colWidth, slotHeight, onEdit, onResize
}: {
  act: PlanningActivite;
  topPx: number;
  heightPx: number;
  isVenue: boolean;
  colWidth: number;
  slotHeight: number;
  onEdit: () => void;
  onResize: (newDurationSlots: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: act.id,
    data: { colWidth },
    disabled: !isVenue,
  });

  const [resizing, setResizing] = React.useState(false);
  const justResized = React.useRef(false);
  const resizeStartY = React.useRef(0);
  const resizeStartHeight = React.useRef(0);
  const [currentHeight, setCurrentHeight] = React.useState(heightPx);

  React.useEffect(() => { setCurrentHeight(heightPx); }, [heightPx]);

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!isVenue) return;
    e.stopPropagation();
    e.preventDefault();
    setResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = currentHeight;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - resizeStartY.current;
      const newH = Math.max(slotHeight, resizeStartHeight.current + delta);
      setCurrentHeight(newH);
    };
    const onUp = (ev: MouseEvent) => {
      const delta = ev.clientY - resizeStartY.current;
      const newH = Math.max(slotHeight, resizeStartHeight.current + delta);
      const newSlots = Math.round(newH / slotHeight);
      onResize(newSlots);
      setResizing(false);
      justResized.current = true;
      setTimeout(() => { justResized.current = false; }, 100);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${topPx}px`,
    height: `${resizing ? currentHeight : heightPx}px`,
    left: '2px',
    right: '2px',
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.7 : 1,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    cursor: isVenue ? (isDragging ? 'grabbing' : 'grab') : 'default',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); if (!isDragging && !resizing && !justResized.current) onEdit(); }}
    >
      <div
        className="h-full rounded-md bg-green-600 text-white text-xs p-1.5 overflow-hidden shadow-sm select-none"
        {...(isVenue ? { ...attributes, ...listeners } : {})}
      >
        <div className="font-semibold truncate">{act.titre}</div>
        <div className="opacity-80 text-[10px]">{act.heureDebut} - {act.heureFin}</div>
        {act.description && <div className="opacity-70 text-[10px] truncate">{act.description}</div>}
        {isVenue && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e); }}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize flex items-center justify-center"
            style={{ zIndex: 20 }}
          >
            <div className="w-6 h-0.5 bg-white opacity-50 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);
  const [tab, setTab] = useState<Tab>('devis');
  const [error, setError] = useState<string | null>(null);

  // Messages
  const [messages, setMessages] = useState<MessageCollab[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Planning
  const [planning, setPlanning] = useState<PlanningActivite[]>([]);
  const [planModal, setPlanModal] = useState<{
    open: boolean;
    date: string;
    heureDebut: string;
    heureFin: string;
    titre: string;
    description: string;
    responsable: string;
    editId?: string;
  } | null>(null);

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
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // Budget
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [lignesCompl, setLignesCompl] = useState<LigneCompl[]>([]);
  const [ligneComplForm, setLigneComplForm] = useState({ categorie: 'Transport', description: '', montant: '' });
  const [recettes, setRecettes] = useState<RecetteBudget[]>([]);
  const [recetteForm, setRecetteForm] = useState({ source: 'Participation familles', montant: '' });

  // Projet pédagogique
  const [dossier, setDossier] = useState<DossierPedagogiqueData | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [objectifsPedago, setObjectifsPedago] = useState('');
  const [lienProgrammes, setLienProgrammes] = useState('');

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
    try {
      const data = await getBudgetData(id);
      setBudgetData(data);
      if (data.lignesCompl) setLignesCompl(data.lignesCompl);
      if (data.recettes) setRecettes(data.recettes);
    } catch { /* ignore */ }
    finally { setBudgetLoading(false); }
  }, [id]);

  const loadDossier = useCallback(async () => {
    if (!id) return;
    setDossierLoading(true);
    try {
      const data = await getDossierPedagogique(id);
      setDossier(data);
      if (!lienProgrammes && data.thematiquesPedagogiques?.length > 0) {
        setLienProgrammes(data.thematiquesPedagogiques.join(', '));
      }
    } catch { /* ignore */ }
    finally { setDossierLoading(false); }
  }, [id]);

  useEffect(() => {
    if (tab === 'devis') loadBudget();
    if (tab === 'messages') loadMessages();
    if (tab === 'planning') loadPlanning();
    if (tab === 'documents') { loadDocs(); loadDocsCentre(); }
    if (tab === 'participants') loadParticipants();
    if (tab === 'budget') loadBudget();
    if (tab === 'projet') loadDossier();
  }, [tab, loadMessages, loadPlanning, loadDocs, loadDocsCentre, loadParticipants, loadBudget, loadDossier]);

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
    if (!planModal || !id) return;
    try {
      if (planModal.editId) {
        await deletePlanning(id, planModal.editId);
        setPlanning(prev => prev.filter(p => p.id !== planModal.editId));
      }
      const newItem = await createPlanning(id, {
        date: planModal.date,
        heureDebut: planModal.heureDebut,
        heureFin: planModal.heureFin,
        titre: planModal.titre,
        description: planModal.description || undefined,
        responsable: planModal.responsable || undefined,
      });
      setPlanning(prev => [...prev, newItem]);
      setPlanModal(null);
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
            {TABS.filter((t) => t.key !== 'projet' || user.role === 'TEACHER').map((t) => (
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
        {/* ── Print CSS ─── */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #devis-print-zone, #devis-print-zone * { visibility: visible; }
            #devis-print-zone { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>

        {/* ── Devis ─── */}
        {tab === 'devis' && (
          <div id="devis-print-zone">
            {budgetLoading && (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!budgetLoading && !budgetData?.devis && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
                <p className="text-sm text-gray-500">Aucun devis sélectionné pour ce séjour.</p>
              </div>
            )}

            {!budgetLoading && budgetData?.devis && (() => {
              const d = budgetData.devis!;
              const s = budgetData.sejour;
              const c = d.centre;
              const createur = s?.createur;
              const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const dateDevis = new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

              // Récapitulatif TVA par taux
              const tvaByRate = d.lignes.reduce<Record<number, { ht: number; tva: number }>>((acc, l) => {
                if (!acc[l.tva]) acc[l.tva] = { ht: 0, tva: 0 };
                acc[l.tva].ht += l.totalHT;
                acc[l.tva].tva += l.totalTTC - l.totalHT;
                return acc;
              }, {});

              const totalHT = d.lignes.reduce((sum, l) => sum + l.totalHT, 0);
              const totalTTC = d.lignes.reduce((sum, l) => sum + l.totalTTC, 0);
              const totalTVA = totalTTC - totalHT;

              return (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-8">

                  {/* Bouton impression */}
                  <div className="flex justify-end print:hidden">
                    <button
                      onClick={() => window.print()}
                      className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors"
                    >
                      Imprimer le devis
                    </button>
                  </div>

                  {/* En-tête : émetteur + destinataire */}
                  <div className="grid grid-cols-2 gap-8">
                    {/* Émetteur (hébergeur) */}
                    <div className="text-sm text-gray-700 space-y-1">
                      <p className="font-bold text-gray-900 text-base">{d.nomEntreprise ?? c?.nom ?? '—'}</p>
                      {(d.adresseEntreprise ?? c?.adresse) && <p>{d.adresseEntreprise ?? c?.adresse}</p>}
                      {c && <p>{c.codePostal} {c.ville}</p>}
                      {(d.telEntreprise ?? c?.telephone) && <p>Tél. : {d.telEntreprise ?? c?.telephone}</p>}
                      {(d.emailEntreprise ?? c?.email) && <p>Email : {d.emailEntreprise ?? c?.email}</p>}
                      {(d.siretEntreprise ?? c?.siret) && <p>N° SIRET : {d.siretEntreprise ?? c?.siret}</p>}
                    </div>

                    {/* Destinataire (établissement) */}
                    <div className="text-sm text-gray-700 space-y-1">
                      {createur?.etablissementNom && <p className="font-bold text-gray-900 text-base">{createur.etablissementNom}</p>}
                      {createur?.prenom && <p>{createur.prenom} {createur.nom}</p>}
                      {createur?.etablissementAdresse && <p>{createur.etablissementAdresse}</p>}
                      {createur?.etablissementVille && <p>{createur.etablissementVille}</p>}
                      {(createur?.etablissementTelephone ?? createur?.telephone) && <p>Tél. : {createur?.etablissementTelephone ?? createur?.telephone}</p>}
                      {(createur?.etablissementEmail ?? createur?.email) && <p>Email : {createur?.etablissementEmail ?? createur?.email}</p>}
                    </div>
                  </div>

                  {/* Numéro devis + titre séjour + date */}
                  <div className="text-center border-y border-gray-200 py-4 space-y-1">
                    {s?.titre && <p className="text-lg font-bold text-gray-900 uppercase">{s.titre}</p>}
                    {d.numeroDevis && <p className="text-base font-semibold text-gray-700">DEVIS N° {d.numeroDevis}</p>}
                    <p className="text-sm text-gray-500">Le {dateDevis}</p>
                    {s?.dateDebut && s?.dateFin && (
                      <p className="text-sm text-gray-500">
                        Du {new Date(s.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} au {new Date(s.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Tableau des lignes */}
                  {d.lignes.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-300">
                            <th className="text-left py-2 pr-4 font-semibold text-gray-700">Désignation</th>
                            <th className="text-right py-2 px-2 font-semibold text-gray-700">Qté</th>
                            <th className="text-right py-2 px-2 font-semibold text-gray-700">PU HT</th>
                            <th className="text-right py-2 px-2 font-semibold text-gray-700">TVA %</th>
                            <th className="text-right py-2 px-2 font-semibold text-gray-700">Total HT</th>
                            <th className="text-right py-2 pl-2 font-semibold text-gray-700">Total TTC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.lignes.map((l) => (
                            <tr key={l.id} className="border-b border-gray-100">
                              <td className="py-2 pr-4 text-gray-900">{l.description}</td>
                              <td className="py-2 px-2 text-right text-gray-600">{l.quantite}</td>
                              <td className="py-2 px-2 text-right text-gray-600">{fmt(l.prixUnitaire)} &euro;</td>
                              <td className="py-2 px-2 text-right text-gray-600">{l.tva} %</td>
                              <td className="py-2 px-2 text-right text-gray-600">{fmt(l.totalHT)} &euro;</td>
                              <td className="py-2 pl-2 text-right font-semibold text-gray-900">{fmt(l.totalTTC)} &euro;</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Récapitulatif TVA + totaux */}
                  <div className="flex justify-end">
                    <div className="w-80 space-y-1 text-sm">
                      {Object.entries(tvaByRate).map(([taux, vals]) => (
                        <div key={taux} className="flex justify-between text-gray-600">
                          <span>TVA {taux} % — Base HT</span>
                          <span>{fmt(vals.ht)} &euro;</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-gray-600">
                          <span>Total HT</span>
                          <span>{fmt(totalHT)} &euro;</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>TVA</span>
                          <span>{fmt(totalTVA)} &euro;</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-300 pt-2">
                          <span>Total TTC</span>
                          <span>{fmt(totalTTC)} &euro;</span>
                        </div>
                      </div>

                      {/* Conditions de paiement */}
                      {d.pourcentageAcompte && d.montantAcompte && (
                        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                          <p className="font-semibold text-gray-700">Conditions de paiement :</p>
                          <p>• {d.pourcentageAcompte} % soit {fmt(d.montantAcompte)} &euro; — Acompte</p>
                          <p>• {100 - d.pourcentageAcompte} % soit {fmt(totalTTC - d.montantAcompte)} &euro; — Solde</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conditions annulation */}
                  {d.conditionsAnnulation && (
                    <div className="text-xs text-gray-500 border-t border-gray-100 pt-4">
                      <p className="font-semibold text-gray-700 mb-1">Conditions d&apos;annulation :</p>
                      <p>{d.conditionsAnnulation}</p>
                    </div>
                  )}

                  {/* Bon pour accord */}
                  <div className="border-t border-gray-200 pt-6 text-sm text-gray-600">
                    <p>Bon pour accord</p>
                  </div>

                </div>
              );
            })()}
          </div>
        )}

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
        {tab === 'planning' && sejour && (() => {
          const isVenue = user?.role === 'VENUE';
          const HOUR_START = 7;
          const HOUR_END = 22;
          const SLOT_HEIGHT = 24;
          const SLOTS = (HOUR_END - HOUR_START) * 2;

          const days: Date[] = [];
          const start = new Date(sejour.dateDebut);
          const end = new Date(sejour.dateFin);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d));
          }

          const DAY_LABELS = ['DIM.', 'LUN.', 'MAR.', 'MER.', 'JEU.', 'VEN.', 'SAM.'];
          const today = new Date();

          const timeToMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return (h - HOUR_START) * 60 + m;
          };

          const minutesToTime = (mins: number) => {
            const totalMins = mins + HOUR_START * 60;
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          };

          const handleCellClick = (date: Date, slotIndex: number) => {
            if (!isVenue) return;
            const h = Math.floor(slotIndex / 2) + HOUR_START;
            const m = slotIndex % 2 === 0 ? '00' : '30';
            const hEnd = slotIndex % 2 === 0 ? h : h + 1;
            const mEnd = slotIndex % 2 === 0 ? '30' : '00';
            const dateStr = date.toISOString().split('T')[0];
            setPlanModal({
              open: true,
              date: dateStr,
              heureDebut: `${String(h).padStart(2,'0')}:${m}`,
              heureFin: `${String(hEnd).padStart(2,'0')}:${mEnd}`,
              titre: '',
              description: '',
              responsable: '',
            });
          };

          const handleDragEnd = async (event: DragEndEvent) => {
            if (!isVenue) return;
            const { active, delta } = event;
            const actId = active.id as string;
            const act = planning.find(p => p.id === actId);
            if (!act) return;

            const deltaSlots = Math.round(delta.y / SLOT_HEIGHT);
            const deltaDays = Math.round(delta.x / (active.data.current?.colWidth ?? 120));

            const startMins = timeToMinutes(act.heureDebut);
            const endMins = timeToMinutes(act.heureFin);
            const duration = endMins - startMins;

            let newStartMins = startMins + deltaSlots * 30;
            newStartMins = Math.max(0, Math.min(newStartMins, (HOUR_END - HOUR_START) * 60 - duration));

            const oldDate = new Date(act.date);
            oldDate.setDate(oldDate.getDate() + deltaDays);
            const sejourStart = new Date(sejour.dateDebut);
            const sejourEnd = new Date(sejour.dateFin);
            const newDate = oldDate < sejourStart ? sejourStart : oldDate > sejourEnd ? sejourEnd : oldDate;
            const newDateStr = newDate.toISOString().split('T')[0];

            const newHeureDebut = minutesToTime(newStartMins);
            const newHeureFin = minutesToTime(newStartMins + duration);

            setPlanning(prev => prev.map(p => p.id === actId ? {
              ...p,
              date: newDateStr + 'T00:00:00.000Z',
              heureDebut: newHeureDebut,
              heureFin: newHeureFin,
            } : p));

            try {
              if (!id) return;
              await deletePlanning(id, actId);
              const newItem = await createPlanning(id, {
                date: newDateStr,
                heureDebut: newHeureDebut,
                heureFin: newHeureFin,
                titre: act.titre,
                description: act.description,
                responsable: act.responsable,
              });
              setPlanning(prev => prev.map(p => p.id === actId ? newItem : p));
            } catch {
              setPlanning(prev => prev.map(p => p.id === actId ? act : p));
            }
          };

          return (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {!isVenue && (
                <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 font-medium">
                  Lecture seule — seul l&apos;hébergeur peut modifier le planning
                </div>
              )}

              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <div className="overflow-x-auto">
                  <div style={{ minWidth: `${56 + days.length * 120}px` }}>

                    {/* Header jours */}
                    <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
                      <div className="w-14 shrink-0" />
                      {days.map((day, i) => {
                        const isToday = day.toDateString() === today.toDateString();
                        return (
                          <div key={i} className="flex-1 text-center py-2 border-l border-gray-200" style={{ minWidth: 120 }}>
                            <div className="text-xs font-medium text-gray-500">{DAY_LABELS[day.getDay()]}</div>
                            <div className={`text-lg font-semibold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                              {day.getDate()}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Corps scrollable */}
                    <div style={{ height: '600px', overflowY: 'auto' }}>
                      <div className="flex relative" style={{ height: `${SLOTS * SLOT_HEIGHT}px` }}>

                        {/* Colonne heures */}
                        <div className="w-14 shrink-0 relative">
                          {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
                            <div key={i}
                              style={{ top: `${i * 2 * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT * 2}px` }}
                              className="absolute w-full flex items-start justify-end pr-2 pt-0.5">
                              <span className="text-[10px] text-gray-400">{String(HOUR_START + i).padStart(2,'0')}:00</span>
                            </div>
                          ))}
                        </div>

                        {/* Colonnes jours */}
                        {days.map((day, dayIdx) => {
                          const dateStr = day.toISOString().split('T')[0];
                          const dayActivities = planning.filter(p => p.date.startsWith(dateStr));
                          const colWidth = 120;

                          return (
                            <DroppableDay
                              key={dayIdx}
                              dayIdx={dayIdx}
                              dateStr={dateStr}
                              isVenue={isVenue}
                              slots={SLOTS}
                              slotHeight={SLOT_HEIGHT}
                              onCellClick={(slotIdx) => handleCellClick(day, slotIdx)}
                            >
                              {dayActivities.map((act) => {
                                const topMin = timeToMinutes(act.heureDebut);
                                const botMin = timeToMinutes(act.heureFin);
                                const duration = botMin - topMin;
                                if (duration <= 0 || topMin < 0) return null;
                                const topPx = (topMin / 30) * SLOT_HEIGHT;
                                const heightPx = Math.max((duration / 30) * SLOT_HEIGHT, SLOT_HEIGHT);
                                return (
                                  <DraggableActivity
                                    key={act.id}
                                    act={act}
                                    topPx={topPx}
                                    heightPx={heightPx}
                                    isVenue={isVenue}
                                    colWidth={colWidth}
                                    slotHeight={SLOT_HEIGHT}
                                    onEdit={() => setPlanModal({
                                      open: true,
                                      date: act.date.split('T')[0],
                                      heureDebut: act.heureDebut,
                                      heureFin: act.heureFin,
                                      titre: act.titre,
                                      description: act.description ?? '',
                                      responsable: act.responsable ?? '',
                                      editId: act.id,
                                    })}
                                    onResize={async (newDurationSlots) => {
                                      if (!isVenue || !id) return;
                                      const startMins = timeToMinutes(act.heureDebut);
                                      const newEndMins = startMins + newDurationSlots * 30;
                                      if (newEndMins <= startMins) return;
                                      const newHeureFin = minutesToTime(newEndMins);
                                      setPlanning(prev => prev.map(p => p.id === act.id ? { ...p, heureFin: newHeureFin } : p));
                                      try {
                                        await deletePlanning(id, act.id);
                                        const newItem = await createPlanning(id, {
                                          date: act.date.split('T')[0],
                                          heureDebut: act.heureDebut,
                                          heureFin: newHeureFin,
                                          titre: act.titre,
                                          description: act.description,
                                          responsable: act.responsable,
                                        });
                                        setPlanning(prev => prev.map(p => p.id === act.id ? newItem : p));
                                      } catch {
                                        setPlanning(prev => prev.map(p => p.id === act.id ? act : p));
                                      }
                                    }}
                                  />
                                );
                              })}
                            </DroppableDay>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </DndContext>

              {/* Modale création/édition */}
              {planModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                  onClick={() => setPlanModal(null)}>
                  <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
                    onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-base font-semibold text-gray-900 mb-4">
                      {planModal.editId ? 'Modifier le créneau' : 'Nouveau créneau'}
                    </h3>
                    <div className="space-y-3">
                      <input type="text" placeholder="Titre *" value={planModal.titre}
                        onChange={(e) => setPlanModal(m => m ? {...m, titre: e.target.value} : m)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Début</label>
                          <input type="time" value={planModal.heureDebut}
                            onChange={(e) => setPlanModal(m => m ? {...m, heureDebut: e.target.value} : m)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Fin</label>
                          <input type="time" value={planModal.heureFin}
                            onChange={(e) => setPlanModal(m => m ? {...m, heureFin: e.target.value} : m)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                        </div>
                      </div>
                      <input type="text" placeholder="Description (optionnel)" value={planModal.description}
                        onChange={(e) => setPlanModal(m => m ? {...m, description: e.target.value} : m)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                      <input type="text" placeholder="Responsable (optionnel)" value={planModal.responsable}
                        onChange={(e) => setPlanModal(m => m ? {...m, responsable: e.target.value} : m)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </div>
                    <div className="flex gap-3 mt-5">
                      {planModal.editId && (
                        <button onClick={async () => {
                          if (!id || !planModal.editId) return;
                          try {
                            await deletePlanning(id, planModal.editId);
                            setPlanning(prev => prev.filter(p => p.id !== planModal.editId));
                            setPlanModal(null);
                          } catch { /* ignore */ }
                        }} className="flex-1 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                          Supprimer
                        </button>
                      )}
                      <button onClick={() => setPlanModal(null)}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Annuler
                      </button>
                      <button onClick={handleAddPlanning} disabled={!planModal.titre}
                        className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                        {planModal.editId ? 'Modifier' : 'Ajouter'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
                      <tr key={p.id} onClick={() => p.signeeAt ? setSelectedParticipant(p) : null} className={`border-b border-gray-100 transition-colors ${p.signeeAt ? 'cursor-pointer hover:bg-blue-50' : 'opacity-60'}`}>
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
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                                Signé
                              </span>
                              <button
                                onClick={async () => {
                                  try {
                                    const { html } = await getOrdreMissionHtml(a.id);
                                    const win = window.open('', '_blank');
                                    if (win) {
                                      win.document.write(html);
                                      win.document.close();
                                    }
                                  } catch { /* ignore */ }
                                }}
                                className="rounded-lg border border-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors print:hidden"
                              >
                                Ordre de mission
                              </button>
                            </>
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

            {/* Modale fiche élève */}
            {selectedParticipant && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                onClick={() => setSelectedParticipant(null)}>
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4"
                  onClick={(e) => e.stopPropagation()}>

                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                      {selectedParticipant.elevePrenom} {selectedParticipant.eleveNom}
                    </h3>
                    <button onClick={() => setSelectedParticipant(null)}
                      className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
                  </div>

                  {/* Infos parent */}
                  <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Contact urgence</p>
                    {selectedParticipant.nomParent && (
                      <p className="text-sm font-medium text-gray-900">{selectedParticipant.nomParent}</p>
                    )}
                    <p className="text-sm text-gray-700">{selectedParticipant.parentEmail}</p>
                    {selectedParticipant.telephoneUrgence && (
                      <p className="text-sm text-gray-700 font-semibold">{selectedParticipant.telephoneUrgence}</p>
                    )}
                  </div>

                  {/* Infos physiques */}
                  <div className="grid grid-cols-3 gap-3">
                    {selectedParticipant.taille && (
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Taille</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedParticipant.taille} cm</p>
                      </div>
                    )}
                    {selectedParticipant.poids && (
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Poids</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedParticipant.poids} kg</p>
                      </div>
                    )}
                    {selectedParticipant.pointure && (
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500">Pointure</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedParticipant.pointure}</p>
                      </div>
                    )}
                  </div>

                  {/* Régime alimentaire */}
                  {selectedParticipant.regimeAlimentaire && (
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Régime alimentaire</p>
                      <p className="text-sm text-gray-700">{selectedParticipant.regimeAlimentaire}</p>
                    </div>
                  )}

                  {/* Niveau ski */}
                  {selectedParticipant.niveauSki && (
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Niveau ski</p>
                      <p className="text-sm text-gray-700">{NIVEAU_SKI_LABEL[selectedParticipant.niveauSki] ?? selectedParticipant.niveauSki}</p>
                    </div>
                  )}

                  {/* Infos médicales */}
                  {selectedParticipant.infosMedicales && (
                    <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                      <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Infos médicales</p>
                      <p className="text-sm text-gray-700">{selectedParticipant.infosMedicales}</p>
                    </div>
                  )}

                  {/* Document médical */}
                  {selectedParticipant.documentMedicalUrl && (
                    <a href={selectedParticipant.documentMedicalUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50">
                      Voir le document médical
                    </a>
                  )}

                  {/* Attestation assurance */}
                  {selectedParticipant.attestationAssuranceUrl && (
                    <a href={selectedParticipant.attestationAssuranceUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50">
                      Voir l&apos;attestation d&apos;assurance
                    </a>
                  )}

                  {/* Signé le */}
                  {selectedParticipant.signeeAt && (
                    <p className="text-xs text-gray-400 text-center">
                      Autorisation signée le {new Date(selectedParticipant.signeeAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
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

              const handleAddLigneCompl = async () => {
                const montant = parseFloat(ligneComplForm.montant);
                if (!ligneComplForm.description.trim() || isNaN(montant) || montant <= 0 || !id) return;
                try {
                  const newLigne = await addLigneCompl(id, { categorie: ligneComplForm.categorie, description: ligneComplForm.description.trim(), montant });
                  setLignesCompl((prev) => [...prev, newLigne]);
                  setLigneComplForm({ categorie: 'Transport', description: '', montant: '' });
                } catch { /* ignore */ }
              };

              const handleAddRecette = async () => {
                const montant = parseFloat(recetteForm.montant);
                if (isNaN(montant) || montant <= 0 || !id) return;
                try {
                  const newRecette = await addRecetteBudget(id, { source: recetteForm.source, montant });
                  setRecettes((prev) => [...prev, newRecette]);
                  setRecetteForm((f) => ({ ...f, montant: '' }));
                } catch { /* ignore */ }
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
                                    <button onClick={async () => { if (!id) return; try { await deleteLigneCompl(id, l.id); setLignesCompl((prev) => prev.filter((x) => x.id !== l.id)); } catch { /* ignore */ } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
                                    <button onClick={async () => { if (!id) return; try { await deleteRecetteBudget(id, r.id); setRecettes((prev) => prev.filter((x) => x.id !== r.id)); } catch { /* ignore */ } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
        {/* ── Projet pédagogique ─── */}
        {tab === 'projet' && user.role === 'TEACHER' && (
          <div className="space-y-6">
            <style>{`@media print { [data-print-hide] { display: none !important; } [data-print-show] { display: block !important; } }`}</style>

            {dossierLoading && (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!dossierLoading && dossier && (() => {
              const d = dossier;
              const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
              const signedAuto = d.autorisations.filter((a) => a.signeeAt).length;
              const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

              const planByDay = d.planningActivites.reduce<Record<string, typeof d.planningActivites>>((acc, p) => {
                const day = p.date.slice(0, 10);
                (acc[day] ??= []).push(p);
                return acc;
              }, {});

              return (
                <>
                  {/* Bouton impression */}
                  <div className="flex justify-end" data-print-hide>
                    <button
                      onClick={() => window.print()}
                      className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90"
                    >
                      Imprimer / Exporter PDF
                    </button>
                  </div>

                  {/* En-tête impression */}
                  <div className="hidden print:block text-center mb-8" data-print-show style={{ display: 'none' }}>
                    <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Projet pédagogique</h1>
                    <p className="text-lg text-gray-700 mt-1">{d.titre}</p>
                    <p className="text-xs text-gray-400 mt-2">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                  </div>

                  {/* Section 2 — Établissement */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Établissement scolaire</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Établissement</span>
                        <p className="font-medium text-gray-900">{d.createur?.etablissementNom ?? '—'}</p>
                        {d.createur?.etablissementUai && <p className="text-xs text-gray-400">UAI : {d.createur.etablissementUai}</p>}
                        {d.createur?.etablissementAdresse && <p className="text-xs text-gray-500">{d.createur.etablissementAdresse}{d.createur.etablissementVille ? `, ${d.createur.etablissementVille}` : ''}</p>}
                      </div>
                      <div>
                        <span className="text-gray-500">Enseignant responsable</span>
                        <p className="font-medium text-gray-900">{d.createur?.prenom} {d.createur?.nom}</p>
                        {d.createur?.email && <p className="text-xs text-gray-500">{d.createur.email}</p>}
                        {d.createur?.telephone && <p className="text-xs text-gray-500">{d.createur.telephone}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Section 3 — Informations séjour */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Informations du séjour</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Dates</span>
                        <p className="font-medium text-gray-900">Du {fmtDate(d.dateDebut)} au {fmtDate(d.dateFin)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Destination</span>
                        <p className="font-medium text-gray-900">{d.lieu}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Nombre d&apos;élèves</span>
                        <p className="font-medium text-gray-900">{d.placesTotales}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Niveau de classe</span>
                        <p className="font-medium text-gray-900">{d.niveauClasse ?? '—'}</p>
                      </div>
                      {d.hebergementSelectionne && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-gray-500 mb-1">Hébergement</p>
                          <div className="flex items-start gap-3">
                            {d.hebergementSelectionne?.imageUrl && (
                              <img
                                src={d.hebergementSelectionne.imageUrl}
                                alt={d.hebergementSelectionne.nom}
                                className="w-16 h-16 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{d.hebergementSelectionne.nom}</p>
                              <p className="text-xs text-gray-500">{d.hebergementSelectionne.adresse}, {d.hebergementSelectionne.ville}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {d.description && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Informations complémentaires</span>
                        <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{d.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Section 4 — Objectifs pédagogiques */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Objectifs pédagogiques du séjour</h3>
                    <textarea
                      value={objectifsPedago}
                      onChange={(e) => setObjectifsPedago(e.target.value)}
                      rows={4}
                      placeholder="Décrivez les objectifs pédagogiques de ce séjour..."
                      className={inputCls}
                      data-print-hide
                    />
                    {objectifsPedago && (
                      <div className="hidden print:block text-sm text-gray-900 whitespace-pre-wrap" data-print-show style={{ display: 'none' }}>
                        {objectifsPedago}
                      </div>
                    )}
                  </div>

                  {/* Section 5 — Lien avec les programmes */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Lien avec les programmes scolaires</h3>
                    <textarea
                      value={lienProgrammes}
                      onChange={(e) => setLienProgrammes(e.target.value)}
                      rows={3}
                      placeholder="Expliquez le lien entre ce séjour et les programmes scolaires..."
                      className={inputCls}
                      data-print-hide
                    />
                    {lienProgrammes && (
                      <div className="hidden print:block text-sm text-gray-900 whitespace-pre-wrap" data-print-show style={{ display: 'none' }}>
                        {lienProgrammes}
                      </div>
                    )}
                  </div>

                  {/* Section 6 — Encadrement */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Encadrement ({d.accompagnateurs.length} accompagnateur{d.accompagnateurs.length > 1 ? 's' : ''})</h3>
                    {d.accompagnateurs.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Aucun accompagnateur enregistré.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Nom</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Email</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Transport</th>
                              <th className="text-center py-2 px-3 font-semibold text-gray-700">Ordre de mission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.accompagnateurs.map((a) => (
                              <tr key={a.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 text-gray-900">{a.prenom} {a.nom}</td>
                                <td className="py-2 px-3 text-gray-600">{a.email}</td>
                                <td className="py-2 px-3 text-gray-600">{a.moyenTransport ?? '—'}</td>
                                <td className="py-2 px-3 text-center">
                                  {a.signeeAt ? (
                                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Signé</span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">En attente</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 7 — Élèves participants */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Élèves participants</h3>
                    <p className="text-sm text-gray-500 mb-4">{signedAuto}/{d.autorisations.length} autorisations signées</p>
                    {d.autorisations.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Aucun élève enregistré.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Nom</th>
                              <th className="text-left py-2 px-3 font-semibold text-gray-700">Prénom</th>
                              <th className="text-center py-2 px-3 font-semibold text-gray-700">Autorisation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.autorisations.map((a, i) => (
                              <tr key={i} className={`border-b border-gray-100 ${i >= 20 ? 'hidden print:table-row' : ''}`}>
                                <td className="py-2 px-3 text-gray-900">{a.eleveNom}</td>
                                <td className="py-2 px-3 text-gray-900">{a.elevePrenom}</td>
                                <td className="py-2 px-3 text-center">
                                  {a.signeeAt ? (
                                    <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Signée</span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">En attente</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {d.autorisations.length > 20 && (
                          <p className="mt-2 text-xs text-gray-400 text-center print:hidden" data-print-hide>
                            {d.autorisations.length - 20} élève{d.autorisations.length - 20 > 1 ? 's' : ''} supplémentaire{d.autorisations.length - 20 > 1 ? 's' : ''} (visible{d.autorisations.length - 20 > 1 ? 's' : ''} à l&apos;impression)
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 8 — Programme prévisionnel */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Programme prévisionnel</h3>
                    {d.planningActivites.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Planning non encore renseigné.</p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(planByDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => (
                          <div key={day}>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Horaire</th>
                                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Activité</th>
                                    <th className="text-left py-1.5 px-3 font-semibold text-gray-700">Responsable</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {items.map((p) => (
                                    <tr key={p.id} className="border-b border-gray-100">
                                      <td className="py-1.5 px-3 text-[var(--color-primary)] font-mono text-xs">{p.heureDebut} - {p.heureFin}</td>
                                      <td className="py-1.5 px-3 text-gray-900">{p.titre}{p.description ? ` — ${p.description}` : ''}</td>
                                      <td className="py-1.5 px-3 text-gray-600">{p.responsable ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 9 — Hébergement */}
                  {d.hebergementSelectionne && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">Centre d&apos;hébergement</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Nom</span>
                          <p className="font-medium text-gray-900">{d.hebergementSelectionne.nom}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Adresse</span>
                          <p className="font-medium text-gray-900">{d.hebergementSelectionne.adresse}, {d.hebergementSelectionne.ville}</p>
                        </div>
                        {d.hebergementSelectionne.telephone && (
                          <div>
                            <span className="text-gray-500">Téléphone</span>
                            <p className="font-medium text-gray-900">{d.hebergementSelectionne.telephone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
}
