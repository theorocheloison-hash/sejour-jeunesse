'use client';

import React from 'react';
import { useEffect, useState, useRef, useCallback, useMemo, type DragEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getSejourCollabInfo,
  getActivitesCatalogue,
  getDocuments,
  createDocument,
  getParticipants,
  getBudgetData,
  getDocumentsCentre,
  addLigneCompl,
  deleteLigneCompl,
  addRecetteBudget,
  deleteRecetteBudget,
  getGroupes,
  createGroupe,
  updateGroupe,
  deleteGroupe,
  proposerGroupes,
  affecterEleve,
  retirerEleve,
  cloturerInscriptions,
  getJournal,
  createJournalPost,
  deleteJournalPost,
  marquerVisite,
} from '@/src/lib/collaboration';
import type {
  SejourCollabInfo,
  DocumentSejour,
  TypeDocumentSejour,
  Participant,
  BudgetData,
  DocumentCentreFiche,
  LigneCompl,
  RecetteBudget,
  ActiviteCatalogue,
  GroupeSejour,
  PropositionGroupes,
  PostJournal,
} from '@/src/lib/collaboration';
import {
  getAccompagnateursBySejour,
  getOrdreMissionHtml,
  type AccompagnateurMission,
} from '@/src/lib/accompagnateur';
import { getDossierPedagogique } from '@/src/lib/sejour';
import { THEMATIQUES, NIVEAUX, type Niveau } from '@/src/data/thematiques-pedagogiques';
import api from '@/src/lib/api';
import { validerPaiement } from '@/src/lib/autorisation';
import type { DossierPedagogiqueData } from '@/src/lib/sejour';
import BudgetPDFButton from '@/src/components/pdf/BudgetPDFButton';
import type { BudgetPDFProps } from '@/src/components/pdf/BudgetPDFButton';
import ProjetPedagogiquePDFButton from '@/src/components/pdf/ProjetPedagogiquePDFButton';
import PreparationTamPDFButton from '@/src/components/pdf/PreparationTamPDFButton';
import HebergeurSidebar from '@/app/dashboard/hebergeur/_components/HebergeurSidebar';
import { useHebergeurCounts } from '@/app/dashboard/hebergeur/_components/useHebergeurCounts';
import { usePermissions } from '@/src/hooks/usePermissions';
import TabDevisFacturation from './_components/TabDevisFacturation';
import TabMessages from './_components/TabMessages';
import TabPlanning from './_components/TabPlanning';
import InviteOrganisateurCard from './_components/InviteOrganisateurCard';
import TabNotes from './_components/TabNotes';
import TabParticipantsSaisieDirecte from './_components/TabParticipantsSaisieDirecte';
import SejourHeader from './_components/SejourHeader';
import SecureImage from '@/src/components/SecureImage';
import SecureFileLink from '@/src/components/SecureFileLink';

function HebergeurSidebarWithCounts({ sejour, logout }: { sejour: SejourCollabInfo | null; logout: () => void }) {
  const { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount } = useHebergeurCounts();
  const { perms, loading: permissionsLoading } = usePermissions();
  return (
    <HebergeurSidebar
      centre={centre ?? {
        nom: sejour?.hebergementSelectionne?.nom ?? null,
        ville: sejour?.hebergementSelectionne?.ville ?? null,
        imageUrl: null,
      }}
      demandesCount={demandesCount}
      rappelsCount={rappelsCount}
      actionsFactCount={actionsFactCount}
      sejoursNonLusCount={sejoursNonLusCount}
      permissions={perms}
      permissionsLoading={permissionsLoading}
      onLogout={logout}
    />
  );
}

// ─── Onglets ────────────────────────────────────────────────────────────────

type Tab = 'devis' | 'messages' | 'planning' | 'groupes' | 'participants' | 'documents' | 'budget' | 'projet' | 'journal' | 'notes';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'https://liavo.fr';

function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'devis', label: 'Devis' },
  { key: 'messages', label: 'Messages' },
  { key: 'planning', label: 'Planning' },
  { key: 'groupes', label: 'Groupes' },
  { key: 'participants', label: 'Participants' },
  { key: 'documents', label: 'Documents' },
  { key: 'journal', label: 'Journal' },
  { key: 'budget', label: 'Budget prévisionnel' },
  { key: 'projet', label: 'Projet pédagogique' },
  { key: 'notes', label: 'Notes & suivi' },
];

const CATEGORIES_COMPL =['Transport', 'Assurance', 'Visites et activités', 'Restauration hors forfait', 'Autre'];
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

function formatDateRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - that.getTime()) / 86400000);
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function PhotoGrid({ photos }: { photos: { id: string; url: string }[] }) {
  if (photos.length === 0) return null;
  if (photos.length === 1) {
    return (
      <SecureImage
        url={photos[0].url}
        className="mt-3 rounded-xl max-h-96 object-cover w-full"
        openOnClick
      />
    );
  }
  if (photos.length === 2) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {photos.map((p) => (
          <SecureImage
            key={p.id}
            url={p.url}
            className="rounded-xl object-cover w-full aspect-square"
            openOnClick
          />
        ))}
      </div>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {photos.map((p, i) => (
        <SecureImage
          key={p.id}
          url={p.url}
          className={`rounded-xl object-cover w-full aspect-square ${i === 0 ? 'col-span-2 row-span-2 aspect-auto h-full' : ''}`}
          openOnClick
        />
      ))}
    </div>
  );
}

function JournalPostCard({
  post,
  canDelete,
  onDelete,
}: {
  post: PostJournal;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const initiales = `${post.auteur.prenom[0] ?? ''}${post.auteur.nom[0] ?? ''}`.toUpperCase();
  const isHebergeur = post.auteur.role === 'HEBERGEUR';
  const roleLabel = isHebergeur ? 'Hébergeur' : 'Enseignant';
  const avatarBg = isHebergeur ? 'var(--color-success)' : 'var(--color-primary)';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
      <div className="flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
          style={{ backgroundColor: avatarBg }}
        >
          {initiales}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {post.auteur.prenom} {post.auteur.nom}
            </span>
            <span className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${isHebergeur ? 'bg-[var(--color-success-light)] text-[var(--color-success)]' : 'bg-blue-50 text-[var(--color-primary)]'}`}>
              {roleLabel}
            </span>
          </div>
          <p className="text-xs text-gray-400">{formatDateRelative(post.createdAt)}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>

      <p className="text-sm text-gray-900 whitespace-pre-wrap mt-3">{post.contenu}</p>
      <PhotoGrid photos={post.photos} />
    </div>
  );
}

export default function CollaborationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  const [sejour, setSejour] = useState<SejourCollabInfo | null>(null);
  const isDirect = sejour?.modeGestion === 'DIRECT';
  const isEvenement = sejour?.natureSejour === 'EVENEMENT';
  const [tab, setTab] = useState<Tab>('devis');
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Invitation organisateur
  // ── Tracking visite onglet (notifications hébergeur) ────────
  useEffect(() => {
    const ONGLETS_TRACKING = ['messages', 'documents', 'journal'];
    if (!user || user.role !== 'HEBERGEUR' || !id || !ONGLETS_TRACKING.includes(tab)) return;
    marquerVisite(id, tab).catch(() => {});
  }, [tab, user, id]);

  // Journal
  const [journalPosts, setJournalPosts] = useState<PostJournal[]>([]);
  const [journalContenu, setJournalContenu] = useState('');
  const [journalPhotos, setJournalPhotos] = useState<File[]>([]);
  const [journalPhotosPreviews, setJournalPhotosPreviews] = useState<string[]>([]);
  const [journalSending, setJournalSending] = useState(false);
  const [journalLinkCopied, setJournalLinkCopied] = useState(false);
  const journalFileRef = useRef<HTMLInputElement>(null);

  // Catalogue d'activités (rechargé à l'ouverture de l'onglet groupes — API inchangée)
  const [activitesCatalogue, setActivitesCatalogue] = useState<ActiviteCatalogue[]>([]);

  // Groupes
  const [groupes, setGroupes] = useState<GroupeSejour[]>([]);
  const [groupeModal, setGroupeModal] = useState<{ open: boolean; editId?: string; nom: string; couleur: string; taille: number } | null>(null);
  const [propositionGroupes, setPropositionGroupes] = useState<PropositionGroupes | null>(null);
  const [loadingProposition, setLoadingProposition] = useState(false);
  const [dragEleve, setDragEleve] = useState<string | null>(null);

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
  const monRoleCollaboratif = useMemo(() => {
    if (!user || !accompagnateurs) return null;
    const moi = accompagnateurs.find((a) => a.userId === user.id && a.accesCollaboratif);
    return moi?.roleCollaboratif ?? null;
  }, [user, accompagnateurs]);
  const estLectureSeule = monRoleCollaboratif === 'LECTURE';
  const estAccompagnateur = monRoleCollaboratif !== null && sejour?.createur?.id !== user?.id;
  const ACCOMPAGNATEUR_TABS: Tab[] = ['planning', 'participants', 'groupes', 'journal'];
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
    if (tab === 'devis' && !isDirect) loadBudget();
    if (tab === 'groupes') {
      getGroupes(id).then(setGroupes).catch(() => {});
      getActivitesCatalogue(id).then(setActivitesCatalogue).catch(() => {});
      loadParticipants();
    }
    if (tab === 'documents') { loadDocs(); loadDocsCentre(); }
    if (tab === 'participants') loadParticipants();
    if (tab === 'budget') loadBudget();
    if (tab === 'projet') loadDossier();
    if (tab === 'journal' && !isDirect) { getJournal(id).then(setJournalPosts).catch(() => {}); }
  }, [tab, isDirect, id, loadDocs, loadDocsCentre, loadParticipants, loadBudget, loadDossier]);

  // ── Journal handlers ──
  const handleAddJournalPhotos = (files: FileList | null) => {
    if (!files) return;
    const remaining = Math.max(0, 6 - journalPhotos.length);
    const accepted = Array.from(files).slice(0, remaining).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
    );
    if (accepted.length === 0) return;
    const previews = accepted.map((f) => URL.createObjectURL(f));
    setJournalPhotos((prev) => [...prev, ...accepted]);
    setJournalPhotosPreviews((prev) => [...prev, ...previews]);
    if (journalFileRef.current) journalFileRef.current.value = '';
  };

  const handleRemoveJournalPhoto = (idx: number) => {
    URL.revokeObjectURL(journalPhotosPreviews[idx]);
    setJournalPhotos((prev) => prev.filter((_, i) => i !== idx));
    setJournalPhotosPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handlePublishJournal = async () => {
    if (!id || !journalContenu.trim()) return;
    setJournalSending(true);
    try {
      const post = await createJournalPost(id, journalContenu.trim(), journalPhotos);
      setJournalPosts((prev) => [post, ...prev]);
      journalPhotosPreviews.forEach((p) => URL.revokeObjectURL(p));
      setJournalContenu('');
      setJournalPhotos([]);
      setJournalPhotosPreviews([]);
    } catch { /* ignore */ }
    setJournalSending(false);
  };

  const handleDeleteJournalPost = async (postId: string) => {
    if (!id) return;
    try {
      await deleteJournalPost(id, postId);
      setJournalPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('[handleDeleteJournalPost]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getJournal(id).then(setJournalPosts).catch(() => {});
    }
  };

  const handleProposerGroupes = async () => {
    if (!id) return;
    setLoadingProposition(true);
    try {
      const prop = await proposerGroupes(id);
      setPropositionGroupes(prop);
    } catch { /* ignore */ }
    finally { setLoadingProposition(false); }
  };

  const handleAppliquerProposition = async () => {
    if (!id || !propositionGroupes) return;
    try {
      const created = await Promise.all(
        propositionGroupes.groupes.map(g => createGroupe(id, g))
      );
      setGroupes(prev => [...prev, ...created]);
      setPropositionGroupes(null);
    } catch { /* ignore */ }
  };

  const handleSaveGroupe = async () => {
    if (!groupeModal || !id) return;
    try {
      if (groupeModal.editId) {
        const updated = await updateGroupe(id, groupeModal.editId, { nom: groupeModal.nom, couleur: groupeModal.couleur, taille: groupeModal.taille });
        setGroupes(prev => prev.map(g => g.id === groupeModal.editId ? updated : g));
      } else {
        const created = await createGroupe(id, { nom: groupeModal.nom, couleur: groupeModal.couleur, taille: groupeModal.taille });
        setGroupes(prev => [...prev, created]);
      }
      setGroupeModal(null);
    } catch (err) {
      console.error('[handleSaveGroupe]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(id).then(setGroupes).catch(() => {});
    }
  };

  const handleDeleteGroupe = async (groupeId: string) => {
    if (!id) return;
    try {
      await deleteGroupe(id, groupeId);
      setGroupes(prev => prev.filter(g => g.id !== groupeId));
    } catch (err) {
      console.error('[handleDeleteGroupe]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(id).then(setGroupes).catch(() => {});
    }
  };

  const handleAffecterEleve = async (autorisationId: string, groupeId: string) => {
    if (!id) return;
    try {
      await affecterEleve(id, groupeId, autorisationId);
      setGroupes(await getGroupes(id));
    } catch (err) {
      console.error('[handleAffecterEleve]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(id).then(setGroupes).catch(() => {});
    }
  };

  const handleRetirerEleve = async (autorisationId: string) => {
    if (!id) return;
    try {
      await retirerEleve(id, autorisationId);
      setGroupes(await getGroupes(id));
    } catch (err) {
      console.error('[handleRetirerEleve]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getGroupes(id).then(setGroupes).catch(() => {});
    }
  };

  const handleCloturerInscriptions = async () => {
    if (!id) return;
    try {
      await cloturerInscriptions(id);
      setSejour(prev => prev ? { ...prev, inscriptionsCloturees: true } : prev);
    } catch (err) {
      console.error('[handleCloturerInscriptions]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      getSejourCollabInfo(id).then(setSejour).catch(() => {});
    }
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
    } catch (err) {
      console.error('[handleAddDocument]', err);
      setMutationError('Une erreur est survenue. Veuillez réessayer.');
      loadDocs();
    }
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
  const isHebergeur = user.role === 'HEBERGEUR';

  return (
    <div className={isHebergeur ? 'flex min-h-screen bg-gray-50' : 'min-h-screen bg-gray-50'}>
      {isHebergeur && (
        <HebergeurSidebarWithCounts sejour={sejour} logout={logout} />
      )}
      <div className={isHebergeur ? 'flex-1 min-w-0 flex flex-col' : ''}>

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
          <div className="flex gap-6">
            {TABS.filter((t) =>
              estAccompagnateur
                ? ACCOMPAGNATEUR_TABS.includes(t.key)
                : (
                  (t.key !== 'projet' || user.role === 'ORGANISATEUR') &&
                  (t.key !== 'budget' || user.role === 'ORGANISATEUR' || isDirector) &&
                  (t.key !== 'groupes' || user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') &&
                  (t.key !== 'journal' || user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') &&
                  (t.key !== 'notes' || user.role === 'HEBERGEUR')
                )
            )
            .filter((t) => {
              // Journal masqué pour tout EVENEMENT (quel que soit le mode de gestion).
              if (isEvenement && (t.key === 'groupes' || t.key === 'projet' || t.key === 'participants' || t.key === 'journal')) return false;
              if (isDirect && (t.key === 'budget' || t.key === 'projet')) return false;
              return true;
            })
            .map((t) => {
              const label = t.key === 'planning' && isEvenement ? 'Programme' : t.label;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-3 text-sm font-medium border-b-2 transition-colors ${
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
          <div className="space-y-6">
            {/* Bandeau clôture inscriptions — ORGANISATEUR uniquement */}
            {user.role === 'ORGANISATEUR' && !sejour?.inscriptionsCloturees && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-800">Inscriptions ouvertes</p>
                  <p className="text-xs text-amber-600 mt-0.5">Clôturez les inscriptions pour affecter les élèves aux groupes.</p>
                </div>
                <button onClick={handleCloturerInscriptions}
                  className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
                  Clôturer les inscriptions
                </button>
              </div>
            )}
            {user.role === 'ORGANISATEUR' && sejour?.inscriptionsCloturees && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 text-sm text-green-700 font-medium">
                ✓ Inscriptions clôturées — vous pouvez affecter les élèves aux groupes
              </div>
            )}

            {/* Actions HEBERGEUR */}
            {user.role === 'HEBERGEUR' && (
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Groupes du séjour</h2>
                <div className="flex gap-2">
                  <button onClick={handleProposerGroupes} disabled={loadingProposition}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50">
                    {loadingProposition ? 'Calcul...' : '✨ Proposer automatiquement'}
                  </button>
                  <button onClick={() => setGroupeModal({ open: true, nom: '', couleur: '#16a34a', taille: 10 })}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                    + Ajouter un groupe
                  </button>
                </div>
              </div>
            )}

            {/* Proposition automatique */}
            {propositionGroupes && user.role === 'HEBERGEUR' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {(() => {
                        const taillesMap = new Map<number, number>();
                        propositionGroupes.groupes.forEach(g => {
                          taillesMap.set(g.taille, (taillesMap.get(g.taille) ?? 0) + 1);
                        });
                        const parts = Array.from(taillesMap.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(([taille, count]) => `${count} groupe${count > 1 ? 's' : ''} de ${taille}`);
                        return `Proposition : ${parts.join(' + ')} élèves`;
                      })()}
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">Basée sur {propositionGroupes.nombreEleves} élèves et les capacités de vos activités</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAppliquerProposition}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      Appliquer
                    </button>
                    <button onClick={() => setPropositionGroupes(null)}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      Ignorer
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {propositionGroupes.groupes.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.couleur }} />
                      <span className="text-xs font-medium text-gray-900">{g.nom}</span>
                      <span className="text-xs text-gray-500">{g.taille} élèves</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Layout deux colonnes : élèves non affectés | groupes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Colonne gauche — élèves non affectés */}
              {sejour?.inscriptionsCloturees && (
                <div className="lg:col-span-1">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Élèves non affectés ({participants.filter(p => !groupes.some(g => g.eleves.some(e => e.autorisationId === p.id))).length})
                  </h3>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto">
                    {participants
                      .filter(p => !groupes.some(g => g.eleves.some(e => e.autorisationId === p.id)))
                      .map(p => (
                        <div
                          key={p.id}
                          draggable={user.role === 'ORGANISATEUR'}
                          onDragStart={() => user.role === 'ORGANISATEUR' && setDragEleve(p.id)}
                          onDragEnd={() => setDragEleve(null)}
                          className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs ${user.role === 'ORGANISATEUR' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold shrink-0">
                            {p.elevePrenom[0]}{p.eleveNom[0]}
                          </div>
                          <span className="truncate font-medium text-gray-900">{p.elevePrenom} {p.eleveNom}</span>
                          {p.signeeAt && <span className="shrink-0 text-green-500">✓</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Colonne droite — cards groupes */}
              <div className={`${sejour?.inscriptionsCloturees ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                {groupes.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
                    {user.role === 'HEBERGEUR' ? 'Créez les groupes ou utilisez la proposition automatique.' : 'Les groupes seront créés par l\'hébergeur.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groupes.map(g => (
                      <div
                        key={g.id}
                        onDragOver={user.role === 'ORGANISATEUR' ? (e) => e.preventDefault() : undefined}
                        onDrop={user.role === 'ORGANISATEUR' ? (e) => { e.preventDefault(); if (dragEleve) { handleAffecterEleve(dragEleve, g.id); setDragEleve(null); } } : undefined}
                        className={`rounded-2xl border-2 bg-white p-4 transition-colors ${dragEleve && user.role === 'ORGANISATEUR' ? 'border-dashed border-[var(--color-primary)] bg-blue-50' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: g.couleur }} />
                            <span className="text-sm font-semibold text-gray-900">{g.nom}</span>
                            <span className="text-xs text-gray-400">({g.eleves.length}/{g.taille})</span>
                          </div>
                          {user.role === 'HEBERGEUR' && (
                            <div className="flex gap-1">
                              <button onClick={() => setGroupeModal({ open: true, editId: g.id, nom: g.nom, couleur: g.couleur, taille: g.taille })}
                                className="rounded p-1 text-gray-400 hover:text-[var(--color-primary)]">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDeleteGroupe(g.id)}
                                className="rounded p-1 text-gray-400 hover:text-red-500">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 min-h-8">
                          {g.eleves.map(e => (
                            <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1 text-xs">
                              <span className="truncate text-gray-900">{e.autorisation.elevePrenom} {e.autorisation.eleveNom}</span>
                              {user.role === 'ORGANISATEUR' && (
                                <button onClick={() => handleRetirerEleve(e.autorisationId)}
                                  className="shrink-0 ml-2 text-gray-300 hover:text-red-400">&times;</button>
                              )}
                            </div>
                          ))}
                          {g.eleves.length === 0 && (
                            <p className="text-xs text-gray-300 text-center py-2">
                              {sejour?.inscriptionsCloturees && user.role === 'ORGANISATEUR' ? 'Glissez des élèves ici' : 'Vide'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modale groupe (HEBERGEUR uniquement) */}
            {groupeModal?.open && user.role === 'HEBERGEUR' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                  <h2 className="text-sm font-semibold text-gray-900 mb-4">{groupeModal.editId ? 'Modifier le groupe' : 'Nouveau groupe'}</h2>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                      <input value={groupeModal.nom}
                        onChange={e => setGroupeModal(m => m ? { ...m, nom: e.target.value } : m)}
                        placeholder="ex: Groupe 1, Les Lynx..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Taille cible (élèves)</label>
                      <input type="number" min="1" value={groupeModal.taille}
                        onChange={e => setGroupeModal(m => m ? { ...m, taille: Number(e.target.value) } : m)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Couleur</label>
                      <div className="flex gap-2 flex-wrap">
                        {['#16a34a','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#be185d','#374151'].map(hex => (
                          <button key={hex} type="button"
                            onClick={() => setGroupeModal(m => m ? { ...m, couleur: hex } : m)}
                            className="w-7 h-7 rounded-full border-2 transition-all"
                            style={{ backgroundColor: hex, borderColor: groupeModal.couleur === hex ? '#1B4060' : 'transparent', transform: groupeModal.couleur === hex ? 'scale(1.2)' : 'scale(1)' }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setGroupeModal(null)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
                    <button onClick={handleSaveGroupe} disabled={!groupeModal.nom.trim()}
                      className="flex-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                      {groupeModal.editId ? 'Modifier' : 'Créer'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Participants ─── */}
        {tab === 'participants' && (
          <div className="space-y-4">
            {sejour && (
              <TabParticipantsSaisieDirecte
                sejourId={sejour.id}
                champsInscription={sejour.hebergementSelectionne?.champsInscription ?? null}
                participants={participants}
                onReload={loadParticipants}
              />
            )}
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
                      {user.role !== 'HEBERGEUR' && <th className="text-center py-3 px-3 font-semibold text-gray-700">Paiement</th>}
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
                        {user.role !== 'HEBERGEUR' && (
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {p.paiementValide ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                              Payé
                            </span>
                          ) : p.moyenPaiement ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                                {p.moyenPaiement === 'VIREMENT' ? 'Virement' :
                                 p.moyenPaiement === 'PRELEVEMENT' ? 'Prélèvement' :
                                 p.moyenPaiement === 'CB' ? 'CB' :
                                 p.moyenPaiement === 'CHEQUE' ? 'Chèque' :
                                 p.moyenPaiement === 'ESPECES' ? 'Espèces' :
                                 p.moyenPaiement}
                              </span>
                              {/* Versements partiels */}
                              {(p.nombreVersementsEffectues ?? 0) > 0 && (
                                <span className="text-xs text-gray-500">
                                  {p.nombreVersementsEffectues}/{p.nombreMensualites ?? 1} versement{(p.nombreMensualites ?? 1) > 1 ? 's' : ''}
                                </span>
                              )}
                              {/* Boutons action */}
                              <div className="flex gap-1 flex-wrap justify-center">
                                {/* Valider un versement partiel si mensualités > 1 */}
                                {(p.nombreMensualites ?? 1) > 1 && (p.nombreVersementsEffectues ?? 0) < (p.nombreMensualites ?? 1) && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const { validerPaiementPartiel } = await import('@/src/lib/autorisation');
                                        await validerPaiementPartiel(p.id, 0);
                                        await loadParticipants();
                                      } catch { /* ignore */ }
                                    }}
                                    className="text-xs text-blue-600 hover:underline font-medium"
                                  >
                                    +1 versement
                                  </button>
                                )}
                                {/* Valider paiement complet */}
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      await validerPaiement(p.id);
                                      await loadParticipants();
                                    } catch { /* ignore */ }
                                  }}
                                  className="text-xs text-[var(--color-primary)] hover:underline font-medium"
                                >
                                  Tout valider
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        )}
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
                    <div className="flex items-center gap-2">
                      <SecureFileLink
                        url={resolveFileUrl(selectedParticipant.documentMedicalUrl)}
                        className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Voir le document médical
                      </SecureFileLink>
                      <SecureFileLink
                        url={resolveFileUrl(selectedParticipant.documentMedicalUrl)}
                        download
                        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </SecureFileLink>
                    </div>
                  )}

                  {/* Attestation assurance */}
                  {selectedParticipant.attestationAssuranceUrl && (
                    <div className="flex items-center gap-2">
                      <SecureFileLink
                        url={resolveFileUrl(selectedParticipant.attestationAssuranceUrl)}
                        className="flex-1 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Voir l&apos;attestation d&apos;assurance
                      </SecureFileLink>
                      <SecureFileLink
                        url={resolveFileUrl(selectedParticipant.attestationAssuranceUrl)}
                        download
                        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                      </SecureFileLink>
                    </div>
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

        {/* ── Journal ─── */}
        {tab === 'journal' && isDirect && (
          <InviteOrganisateurCard
            sejourId={id}
            pending={sejour?.invitationCollab ?? null}
            title="Journal de séjour"
            subtitle="Invitez l'organisateur à rejoindre l'espace collaboratif pour publier dans le journal."
            icon={
              <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            }
          />
        )}

        {tab === 'journal' && !isDirect && (
          <div>
            {/* Zone de publication */}
            {(user.role === 'ORGANISATEUR' || user.role === 'HEBERGEUR') && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
                <textarea
                  value={journalContenu}
                  onChange={(e) => setJournalContenu(e.target.value.slice(0, 2000))}
                  placeholder="Racontez la journée…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[var(--color-border-strong)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-gray-400">{journalContenu.length} / 2000</span>
                </div>

                {journalPhotosPreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {journalPhotosPreviews.map((src, i) => (
                      <div key={i} className="relative">
                        <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => handleRemoveJournalPhoto(i)}
                          aria-label="Retirer la photo"
                          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center hover:bg-black"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={() => journalFileRef.current?.click()}
                    disabled={journalPhotos.length >= 6}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Ajouter des photos {journalPhotos.length > 0 && `(${journalPhotos.length}/6)`}
                  </button>
                  <input
                    ref={journalFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => handleAddJournalPhotos(e.target.files)}
                  />
                  <button
                    type="button"
                    onClick={handlePublishJournal}
                    disabled={journalSending || !journalContenu.trim() || estLectureSeule}
                    title={estLectureSeule ? 'Accès en lecture seule' : undefined}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {journalSending ? 'Publication…' : 'Publier'}
                  </button>
                </div>
              </div>
            )}

            {/* Fil */}
            {journalPosts.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
                <svg className="h-10 w-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <p className="text-sm text-gray-500">Aucune publication pour l&apos;instant. Partagez les moments du séjour avec les familles !</p>
              </div>
            ) : (
              <div>
                {journalPosts.map((post) => (
                  <JournalPostCard
                    key={post.id}
                    post={post}
                    canDelete={post.auteur.id === user.id}
                    onDelete={() => handleDeleteJournalPost(post.id)}
                  />
                ))}
              </div>
            )}

            {/* Lien parent */}
            {user.role === 'ORGANISATEUR' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6">
                <p className="text-sm text-blue-900 mb-3">
                  Les parents peuvent consulter ce journal via le lien de leur autorisation parentale. Chaque parent accède au journal depuis la page : <code className="text-xs bg-white border border-blue-200 rounded px-1.5 py-0.5">liavo.fr/sejour/&#123;token&#125;/journal</code>
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText('https://liavo.fr/sejour/{token}/journal');
                    setJournalLinkCopied(true);
                    setTimeout(() => setJournalLinkCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {journalLinkCopied ? 'Copié !' : 'Copier le lien d\'exemple'}
                </button>
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
                        <div className="shrink-0 flex items-center gap-2">
                          <SecureFileLink url={d.url}
                            className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Voir
                          </SecureFileLink>
                          <SecureFileLink url={d.url} download
                            className="text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-primary-light)] transition-colors inline-flex items-center gap-1">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Télécharger
                          </SecureFileLink>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isDirector && (
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
                disabled={!docForm.nom || !docFile || docSending || estLectureSeule}
                title={estLectureSeule ? 'Accès en lecture seule' : undefined}
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
            )}

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
                  <div className="shrink-0 flex items-center gap-2">
                    <SecureFileLink url={d.url}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-colors inline-flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Voir
                    </SecureFileLink>
                    <SecureFileLink url={d.url} download
                      className="text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 hover:bg-[var(--color-primary-light)] transition-colors inline-flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Télécharger
                    </SecureFileLink>
                  </div>
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
              const isTeacher = user.role === 'ORGANISATEUR';

              const lignesDevis = d?.lignes ?? [];
              const totalHebergeur = lignesDevis.length > 0
                ? lignesDevis.reduce((sum, l) => sum + l.totalTTC, 0)
                : (d?.montantTTC ?? 0);
              const totalCompl = lignesCompl.reduce((sum, l) => sum + l.montant, 0);
              const totalDepenses = totalHebergeur + totalCompl;
              const totalRecettes = recettes.reduce((sum, r) => sum + r.montant, 0);
              const solde = totalRecettes - totalDepenses;

              const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
              const fmtDate = (iso: string | null) => !iso ? 'Dates à définir' : new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

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
                            {s.createur.memberships?.[0]?.organisation.nom && (
                              <p>{s.createur.memberships[0].organisation.nom}{s.createur.memberships[0].organisation.uai ? ` (UAI : ${s.createur.memberships[0].organisation.uai})` : ''}</p>
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
                        <BudgetPDFButton
                          budgetProps={{
                            titreSejour: s?.titre ?? '',
                            dateDebut: s?.dateDebut ?? '',
                            dateFin: s?.dateFin ?? '',
                            nombreEleves: s?.placesTotales ?? 0,
                            enseignantNom: s?.createur ? `${s.createur.prenom} ${s.createur.nom}` : undefined,
                            etablissementNom: s?.createur?.memberships?.[0]?.organisation.nom ?? undefined,
                            lignesHebergeur: lignesDevis.map(l => ({ description: l.description, quantite: l.quantite, prixUnitaire: l.prixUnitaire, tva: l.tva, totalTTC: l.totalTTC })),
                            totalHebergeur,
                            lignesCompl: lignesCompl.map(l => ({ categorie: l.categorie, description: l.description, montant: l.montant })),
                            totalCompl,
                            recettes: recettes.map(r => ({ source: r.source, montant: r.montant })),
                            totalRecettes,
                            totalDepenses,
                            solde,
                          }}
                          filename={`budget-${s?.titre?.toLowerCase().replace(/\s+/g, '-') ?? 'sejour'}.pdf`}
                        />
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
                                    <button onClick={async () => { if (!id) return; try { await deleteLigneCompl(id, l.id); setLignesCompl((prev) => prev.filter((x) => x.id !== l.id)); } catch (err) { console.error('[deleteLigneCompl]', err); setError('Une erreur est survenue. Veuillez réessayer.'); loadBudget(); } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
                                    <button onClick={async () => { if (!id) return; try { await deleteRecetteBudget(id, r.id); setRecettes((prev) => prev.filter((x) => x.id !== r.id)); } catch (err) { console.error('[deleteRecetteBudget]', err); setError('Une erreur est survenue. Veuillez réessayer.'); loadBudget(); } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
        {tab === 'projet' && user.role === 'ORGANISATEUR' && (
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
                  {/* Boutons PDF */}
                  <div className="flex justify-end gap-2 flex-wrap" data-print-hide>
                    <ProjetPedagogiquePDFButton
                      data={d}
                      objectifsPedago={objectifsPedago}
                      lienProgrammes={lienProgrammes}
                      filename={`projet-pedagogique-${d.titre?.toLowerCase().replace(/\s+/g, '-') ?? 'sejour'}.pdf`}
                    />
                    {d.typeContexte === 'HORS_SCOLAIRE' && (
                      <PreparationTamPDFButton data={d} sejourId={id} />
                    )}
                  </div>

                  {/* En-tête impression */}
                  <div className="hidden print:block text-center mb-8" data-print-show style={{ display: 'none' }}>
                    <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Projet pédagogique</h1>
                    <p className="text-lg text-gray-700 mt-1">{d.titre}</p>
                    <p className="text-xs text-gray-400 mt-2">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                  </div>

                  {/* Section 2 — Établissement */}
                  <div id="projet-print-content" className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Établissement scolaire</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Établissement</span>
                        <p className="font-medium text-gray-900">{d.createur?.memberships?.[0]?.organisation.nom ?? '—'}</p>
                        {d.createur?.memberships?.[0]?.organisation.uai && <p className="text-xs text-gray-400">UAI : {d.createur.memberships[0].organisation.uai}</p>}
                        {d.createur?.memberships?.[0]?.organisation.ville && <p className="text-xs text-gray-500">{d.createur.memberships[0].organisation.ville}</p>}
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

                  {/* Section 5b — Budget prévisionnel */}
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:shadow-none print:border-gray-300">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Budget prévisionnel</h3>

                    {/* Prestations hébergeur */}
                    {d.demandes?.[0]?.devis?.[0]?.lignes?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prestations hébergeur</p>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1 text-xs font-medium text-gray-600">Description</th>
                              <th className="text-right py-1 text-xs font-medium text-gray-600">Qté</th>
                              <th className="text-right py-1 text-xs font-medium text-gray-600">PU HT</th>
                              <th className="text-right py-1 text-xs font-medium text-gray-600">Total TTC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.demandes[0].devis[0].lignes.map((l, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-1 text-gray-700">{l.description}</td>
                                <td className="py-1 text-right text-gray-600">{l.quantite}</td>
                                <td className="py-1 text-right text-gray-600">{l.prixUnitaire.toFixed(2)} €</td>
                                <td className="py-1 text-right font-medium text-gray-900">{l.totalTTC.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Dépenses complémentaires */}
                    {d.lignesBudget?.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dépenses complémentaires</p>
                        <table className="w-full text-sm">
                          <tbody>
                            {d.lignesBudget.map((l) => (
                              <tr key={l.id} className="border-b border-gray-50">
                                <td className="py-1 text-gray-600">{l.categorie}</td>
                                <td className="py-1 text-gray-700">{l.description}</td>
                                <td className="py-1 text-right font-medium text-gray-900">{l.montant.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Recettes */}
                    {d.recettesBudget?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recettes</p>
                        <table className="w-full text-sm">
                          <tbody>
                            {d.recettesBudget.map((r) => (
                              <tr key={r.id} className="border-b border-gray-50">
                                <td className="py-1 text-gray-600">{r.source}</td>
                                <td className="py-1 text-right font-medium text-gray-900">{r.montant.toFixed(2)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!d.demandes?.[0]?.devis?.[0]?.lignes?.length && !d.lignesBudget?.length && !d.recettesBudget?.length && (
                      <p className="text-sm text-gray-400 text-center py-4">Aucune donnée budgétaire renseignée.</p>
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
                      <div>
                        {Object.entries(planByDay)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([day, items]) => (
                            <div key={day} className="mb-4">
                              <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1.5">
                                {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </p>
                              <table className="w-full text-sm border-collapse">
                                <thead>
                                  <tr className="bg-[var(--color-primary)] text-white">
                                    <th className="text-left px-3 py-1.5 text-xs font-medium w-32">Horaire</th>
                                    <th className="text-left px-3 py-1.5 text-xs font-medium">Activité</th>
                                    <th className="text-left px-3 py-1.5 text-xs font-medium w-32">Responsable</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(items as typeof d.planningActivites).map((p, i) => (
                                    <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                      <td className="px-3 py-1.5 text-xs font-mono text-gray-600 border-b border-gray-100">
                                        {p.heureDebut} – {p.heureFin}
                                      </td>
                                      <td className="px-3 py-1.5 text-sm text-gray-900 border-b border-gray-100 font-medium">
                                        {p.titre}
                                        {p.description && <span className="block text-xs text-gray-500 font-normal">{p.description}</span>}
                                      </td>
                                      <td className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
                                        {p.responsable ?? '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))
                        }
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
                  </div>
                </>
              );
            })()}
          </div>
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
    </div>
  );
}
