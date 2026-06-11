'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  getDevisForSejourDirect,
  getDevisComplementairesForSejour,
  createDevisComplementaire,
  envoyerDevisDirect,
  emettreFactureAcompte,
  emettreFactureSolde,
  emettreFactureTotal,
  ajouterVersement,
  getFacturesForDevis,
  supprimerVersement,
  regenererFacturePdf,
  emettreAvoir,
  annulerDevis,
  genererConvention,
} from '@/src/lib/devis';
import type { Devis as DevisType, Facture, VersementPaiement } from '@/src/lib/devis';
import OrganisationSearch from '@/src/components/OrganisationSearch';
import type { OrganisationResult } from '@/src/components/OrganisationSearch';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import api from '@/src/lib/api';
import type { SejourCollabInfo, BudgetData } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';

interface TabDevisFacturationProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  user: User;
  isDirect: boolean;
  budgetData: BudgetData | null;
  budgetLoading: boolean;
  onBudgetReload: () => Promise<void>;
  onError: (message: string) => void;
}

function DevisPDFInline({ data }: { data: DevisPDFProps }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer');
        const { default: DevisPDF } = await import('@/src/components/pdf/DevisPDF');
        const blob = await pdf(<DevisPDF {...data} />).toBlob();
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-48 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        Génération du PDF...
      </div>
    </div>
  );

  if (!url) return null;

  return (
    <iframe
      src={url}
      className="w-full rounded-2xl border border-gray-200 shadow-sm"
      style={{ height: '80vh', minHeight: 600 }}
      title="Aperçu du devis"
    />
  );
}

/**
 * Lien de téléchargement du PDF d'une facture (généré serveur, stocké sur OVH).
 * - pdfUrl présent → lien direct vers l'URL OVH publique (pas d'auth requise).
 * - pdfUrl null (génération échouée) → bouton « Régénérer le PDF ».
 */
function FacturePdfLink({ facture, onReload }: { facture: Facture; onReload: () => Promise<void> }) {
  const [regenerating, setRegenerating] = useState(false);
  const label =
    facture.typeFacture === 'ACOMPTE' ? "Facture d'acompte"
    : facture.typeFacture === 'SOLDE' ? 'Facture de solde'
    : "Facture d'avoir";

  if (facture.pdfUrl) {
    return (
      <a
        href={facture.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {label} — {facture.numero}
      </a>
    );
  }

  return (
    <button
      onClick={async () => {
        setRegenerating(true);
        try {
          await regenererFacturePdf(facture.id);
          await onReload();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? 'Erreur lors de la régénération du PDF';
          alert(msg);
        } finally {
          setRegenerating(false);
        }
      }}
      disabled={regenerating}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
      title="Le PDF n'a pas pu être généré à l'émission — relancer la génération"
    >
      {regenerating ? 'Génération…' : `Régénérer le PDF (${label})`}
    </button>
  );
}

export default function TabDevisFacturation({
  sejourId,
  sejour,
  user,
  isDirect,
  budgetData,
  budgetLoading,
  onBudgetReload,
  onError,
}: TabDevisFacturationProps) {
  // ── Devis DIRECT ────────────────────────────────────────────
  const [directDevis, setDirectDevis] = useState<DevisType | null>(null);
  const [directDevisLoading, setDirectDevisLoading] = useState(false);
  const [envoyerLoading, setEnvoyerLoading] = useState(false);
  const [envoyerSuccess, setEnvoyerSuccess] = useState(false);
  const [showEnvoiModal, setShowEnvoiModal] = useState(false);
  const [messagePerso, setMessagePerso] = useState('');
  const [envoiError, setEnvoiError] = useState<string | null>(null);

  // ── Convention séjour scolaire ──────────────────────────────
  const [conventionLoading, setConventionLoading] = useState(false);
  const [conventionSuccess, setConventionSuccess] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Aperçu PDF sans effet de bord (pas d'envoi). Ouvre le PDF dans un nouvel onglet.
  const handlePreviewConvention = async (devisId: string) => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/devis/${devisId}/convention/preview`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
    } catch {
      onError('Erreur lors de la prévisualisation de la convention');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Génère + envoie la convention par email au contact (après confirmation).
  const handleGenererConvention = async (devisId: string, contactEmail?: string | null) => {
    const cible = contactEmail || 'l\'établissement';
    if (!window.confirm(`La convention sera envoyée par email à ${cible}. Continuer ?`)) return;
    setConventionLoading(true);
    setConventionSuccess(false);
    try {
      await genererConvention(devisId);
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
      setConventionSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la génération de la convention';
      onError(msg);
    } finally {
      setConventionLoading(false);
    }
  };

  // Fermeture de la modale d'envoi sur Escape
  useEffect(() => {
    if (!showEnvoiModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !envoyerLoading) setShowEnvoiModal(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showEnvoiModal, envoyerLoading]);

  // ── Invitation direction (devis collab) ─────────────────────
  const [showInvitationDirection, setShowInvitationDirection] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationSending, setInvitationSending] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const signatureFileRef = useRef<HTMLInputElement>(null);

  // ── Pipeline facturation (Lot 1 : entités Facture immuables) ─
  const [factures, setFactures] = useState<Facture[]>([]);
  const [facturesLoading, setFacturesLoading] = useState(false);
  const [facturerLoading, setFacturerLoading] = useState(false);
  const [showAddVersement, setShowAddVersement] = useState(false);
  const [versementForm, setVersementForm] = useState({ montant: '', datePaiement: '', reference: '', modePaiement: '' });
  const [versementSaving, setVersementSaving] = useState(false);

  // ── Modale avoir ────────────────────────────────────────────
  const [showModalAvoir, setShowModalAvoir] = useState(false);
  const [avoirFactureSource, setAvoirFactureSource] = useState<Facture | null>(null);
  const [avoirMontant, setAvoirMontant] = useState(0);
  const [avoirMotif, setAvoirMotif] = useState('');
  const [avoirLignes, setAvoirLignes] = useState<Array<{
    description: string; quantite: number; prixUnitaire: number;
    tva: number; totalHT: number; totalTTC: number; selected: boolean;
  }>>([]);
  const [avoirLoading, setAvoirLoading] = useState(false);
  const [avoirError, setAvoirError] = useState<string | null>(null);
  const [annulerLoading, setAnnulerLoading] = useState(false);
  const [showModalAnnuler, setShowModalAnnuler] = useState(false);

  // ── Devis complémentaires ────────────────────────────────────────────────
  const [complementaires, setComplementaires] = useState<DevisType[]>([]);
  const [complementairesLoading, setComplementairesLoading] = useState(false);
  const [showModalComplementaire, setShowModalComplementaire] = useState(false);
  const [compForm, setCompForm] = useState({
    destinataireNom: '',
    destinataireAdresse: '',
    destinataireCodePostal: '',
    destinataireVille: '',
    destinataireSiret: '',
    destinataireEmail: '',
    tauxTva: 0,
    description: '',
    lignes: [{ description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0 }],
  });
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [compFacturerLoading, setCompFacturerLoading] = useState<string | null>(null); // id du devis en cours
  const [compFacturesMap, setCompFacturesMap] = useState<Record<string, Facture[]>>({}); // devisId → factures
  const [compSelectedOrg, setCompSelectedOrg] = useState<OrganisationResult | null>(null);

  const loadComplementaires = useCallback(async () => {
    if (!isDirect) return;
    setComplementairesLoading(true);
    try {
      const list = await getDevisComplementairesForSejour(sejourId);
      setComplementaires(list);
      // Charger les factures de chaque complémentaire
      const map: Record<string, Facture[]> = {};
      await Promise.all(
        list.map(async (c) => {
          if (c.factures) {
            map[c.id] = c.factures;
          } else {
            try {
              map[c.id] = await getFacturesForDevis(c.id);
            } catch { map[c.id] = []; }
          }
        })
      );
      setCompFacturesMap(map);
    } catch { /* ignore */ }
    finally { setComplementairesLoading(false); }
  }, [isDirect, sejourId]);

  /** Recharge le devis principal ET les complémentaires après une action. */
  const reloadAllDirect = async () => {
    const devis = await getDevisForSejourDirect(sejourId);
    setDirectDevis(devis[0] ?? null);
    await loadComplementaires();
  };

  useEffect(() => {
    if (!isDirect) return;
    setDirectDevisLoading(true);
    Promise.all([
      getDevisForSejourDirect(sejourId).then(devis => setDirectDevis(devis[0] ?? null)),
      loadComplementaires(),
    ])
      .catch(() => {})
      .finally(() => setDirectDevisLoading(false));
  }, [isDirect, sejourId, loadComplementaires]);

  // Devis actif (DIRECT ou COLLAB) normalisé pour le pipeline facturation
  const activeDevisForFacturation = isDirect
    ? directDevis
      ? {
          id: directDevis.id,
          statut: directDevis.statut,
          montantTTC: Number(directDevis.montantTTC ?? 0),
          montantAcompte: Number(directDevis.montantAcompte ?? 0),
          pourcentageAcompte: Number(directDevis.pourcentageAcompte ?? 30),
          factures: directDevis.factures ?? null,
        }
      : null
    : budgetData?.devis
      ? {
          id: budgetData.devis.id,
          statut: budgetData.devis.statut,
          montantTTC: Number(budgetData.devis.montantTTC ?? budgetData.devis.montantTotal ?? 0),
          montantAcompte: Number(budgetData.devis.montantAcompte ?? 0),
          pourcentageAcompte: Number(budgetData.devis.pourcentageAcompte ?? 30),
          factures: (budgetData.devis as { factures?: Facture[] }).factures ?? null,
        }
      : null;

  const activeDevisId = activeDevisForFacturation?.id ?? null;
  const activeDevisStatut = activeDevisForFacturation?.statut ?? null;
  // factures incluses dans la réponse devis (Lot 1 backend) si présentes
  const activeDevisFactures = activeDevisForFacturation?.factures ?? null;

  // Recharge les factures du devis depuis l'API (source de vérité après chaque action).
  const reloadFactures = async () => {
    if (!activeDevisId) return;
    try {
      setFactures(await getFacturesForDevis(activeDevisId));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!activeDevisId || !activeDevisStatut) return;
    const FACTURATION_STATUTS = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];
    if (!FACTURATION_STATUTS.includes(activeDevisStatut)) return;
    // Factures déjà incluses dans la réponse devis → on les utilise sans appel réseau.
    if (activeDevisFactures) {
      setFactures(activeDevisFactures);
      return;
    }
    setFacturesLoading(true);
    getFacturesForDevis(activeDevisId)
      .then(setFactures)
      .catch(() => {})
      .finally(() => setFacturesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevisId, activeDevisStatut]);

  // Factures dérivées
  const factureAcompte = factures.find(f => f.typeFacture === 'ACOMPTE') ?? null;
  const factureSolde = factures.find(f => f.typeFacture === 'SOLDE') ?? null;
  const etatFacturation: 'AUCUNE' | 'ACOMPTE' | 'SOLDE' =
    factureSolde ? 'SOLDE' : factureAcompte ? 'ACOMPTE' : 'AUCUNE';
  // Facture cible des versements : la dernière émise (solde si présent, sinon acompte).
  const factureActive = factureSolde ?? factureAcompte;
  const versements: VersementPaiement[] = factures.flatMap(f => f.versements ?? []);

  const handleFacturerAcompte = async () => {
    if (!activeDevisId) return;
    setFacturerLoading(true);
    try {
      await emettreFactureAcompte(activeDevisId);
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
      await reloadFactures();
    } catch {
      onError('Erreur lors de la facturation de l\'acompte');
    } finally {
      setFacturerLoading(false);
    }
  };

  const handleFacturerSolde = async () => {
    if (!activeDevisId) return;
    setFacturerLoading(true);
    try {
      await emettreFactureSolde(activeDevisId);
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
      await reloadFactures();
    } catch {
      onError('Erreur lors de la facturation du solde');
    } finally {
      setFacturerLoading(false);
    }
  };

  const handleFacturerTotal = async () => {
    if (!activeDevisId) return;
    setFacturerLoading(true);
    try {
      await emettreFactureTotal(activeDevisId);
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
      await reloadFactures();
    } catch {
      onError('Erreur lors de la facturation du total');
    } finally {
      setFacturerLoading(false);
    }
  };

  const handleAjouterVersement = async () => {
    if (!factureActive || !versementForm.montant || !versementForm.datePaiement) return;
    setVersementSaving(true);
    try {
      await ajouterVersement(
        factureActive.id,
        parseFloat(versementForm.montant),
        versementForm.datePaiement,
        versementForm.reference || undefined,
        versementForm.modePaiement || undefined,
      );
      await reloadFactures();
      setVersementForm({ montant: '', datePaiement: '', reference: '', modePaiement: '' });
      setShowAddVersement(false);
    } catch {
      onError('Erreur lors de l\'ajout du versement');
    } finally {
      setVersementSaving(false);
    }
  };

  const handleSupprimerVersement = async (versement: VersementPaiement) => {
    const factureId = versement.factureId ?? factureActive?.id;
    if (!factureId) return;
    try {
      await supprimerVersement(factureId, versement.id);
      await reloadFactures();
    } catch {
      onError('Erreur lors de la suppression du versement');
    }
  };

  const openModalAvoir = async (fa: Facture) => {
    // Si les lignes ne sont pas chargées, recharger d'abord
    let lignesSource = fa.lignes ?? [];
    if (!lignesSource.length && fa.id) {
      await reloadFactures();
      // Récupérer la FA mise à jour depuis le state
      const faUpdated = factures.find(f => f.id === fa.id);
      lignesSource = faUpdated?.lignes ?? [];
    }
    const lignesMapped = lignesSource.map(l => ({
      description: l.description,
      quantite: -Math.abs(l.quantite),
      prixUnitaire: l.prixUnitaire,
      tva: l.tva,
      totalHT: -Math.abs(l.totalHT),
      totalTTC: -Math.abs(l.totalTTC),
      selected: true,
    }));
    setAvoirLignes(lignesMapped);
    setAvoirFactureSource(fa);
    const total = lignesMapped.reduce((sum, l) => sum + Math.abs(l.totalTTC), 0);
    setAvoirMontant(Math.round(total * 100) / 100);
    setAvoirMotif('');
    setAvoirError(null);
    setShowModalAvoir(true);
  };

  const handleToggleLigneAvoir = (index: number) => {
    setAvoirLignes(prev => {
      const next = prev.map((l, i) => i === index ? { ...l, selected: !l.selected } : l);
      const total = next.filter(l => l.selected).reduce((sum, l) => sum + Math.abs(l.totalTTC), 0);
      setAvoirMontant(Math.round(total * 100) / 100);
      return next;
    });
  };

  const handleSubmitAvoir = async () => {
    if (!avoirFactureSource) return;
    if (!avoirMotif.trim()) {
      setAvoirError('Le motif est obligatoire');
      return;
    }
    if (avoirMontant <= 0) {
      setAvoirError('Sélectionnez au moins une ligne');
      return;
    }
    const lignesSelectionnees = avoirLignes
      .filter(l => l.selected)
      .map(({ selected: _, ...l }) => l);
    setAvoirLoading(true);
    setAvoirError(null);
    try {
      await emettreAvoir(avoirFactureSource.id, avoirMontant, avoirMotif, lignesSelectionnees);
      setShowModalAvoir(false);
      await reloadFactures();
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de l\'émission de l\'avoir';
      setAvoirError(msg);
    } finally {
      setAvoirLoading(false);
    }
  };

  const handleAnnulerDevis = async () => {
    if (!activeDevisId) return;
    setAnnulerLoading(true);
    try {
      await annulerDevis(activeDevisId);
      setShowModalAnnuler(false);
      if (isDirect) {
        await reloadAllDirect();
      } else {
        await onBudgetReload();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de l\'annulation';
      onError(msg);
      setShowModalAnnuler(false);
    } finally {
      setAnnulerLoading(false);
    }
  };

  // ── Devis complémentaires : handlers ──────────────────────────────────────
  const handleSelectCompOrg = (org: OrganisationResult) => {
    setCompSelectedOrg(org);
    setCompForm(f => ({
      ...f,
      destinataireNom: org.nom,
      destinataireAdresse: org.adresse ?? f.destinataireAdresse,
      destinataireCodePostal: org.codePostal ?? f.destinataireCodePostal,
      destinataireVille: org.ville ?? f.destinataireVille,
      destinataireSiret: org.siret ?? f.destinataireSiret,
      destinataireEmail: org.email ?? f.destinataireEmail,
    }));
  };

  const addCompLigne = () =>
    setCompForm(f => ({ ...f, lignes: [...f.lignes, { description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0 }] }));
  const removeCompLigne = (index: number) =>
    setCompForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== index) }));
  const updateCompLigne = (index: number, field: 'description' | 'quantite' | 'prixUnitaire', value: string) =>
    setCompForm(f => ({
      ...f,
      lignes: f.lignes.map((l, i) => i === index
        ? { ...l, [field]: field === 'description' ? value : Number(value) || 0 }
        : l),
    }));

  const calcCompTotaux = () => {
    return compForm.lignes.map(l => {
      const totalHT = l.quantite * l.prixUnitaire;
      const totalTTC = totalHT * (1 + compForm.tauxTva / 100);
      return { ...l, tva: compForm.tauxTva, totalHT: Math.round(totalHT * 100) / 100, totalTTC: Math.round(totalTTC * 100) / 100 };
    });
  };

  const compTotalTTC = calcCompTotaux().reduce((s, l) => s + l.totalTTC, 0);

  const resetCompForm = () => {
    setCompForm({
      destinataireNom: '', destinataireAdresse: '', destinataireCodePostal: '',
      destinataireVille: '', destinataireSiret: '', destinataireEmail: '',
      tauxTva: 0, description: '',
      lignes: [{ description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0 }],
    });
    setCompSelectedOrg(null);
    setCompError(null);
  };

  const handleCreerComplementaire = async () => {
    if (!compForm.destinataireNom.trim()) {
      setCompError('Le nom du destinataire est obligatoire');
      return;
    }
    const lignesCalculees = calcCompTotaux();
    if (lignesCalculees.length === 0 || lignesCalculees.every(l => l.totalTTC === 0)) {
      setCompError('Ajoutez au moins une ligne avec un montant');
      return;
    }
    setCompLoading(true);
    setCompError(null);
    try {
      await createDevisComplementaire({
        sejourDirectId: sejourId,
        destinataireNom: compForm.destinataireNom.trim(),
        destinataireAdresse: compForm.destinataireAdresse || undefined,
        destinataireCodePostal: compForm.destinataireCodePostal || undefined,
        destinataireVille: compForm.destinataireVille || undefined,
        destinataireSiret: compForm.destinataireSiret || undefined,
        destinataireEmail: compForm.destinataireEmail || undefined,
        tauxTva: compForm.tauxTva,
        description: compForm.description || undefined,
        lignes: lignesCalculees,
      });
      setShowModalComplementaire(false);
      resetCompForm();
      await loadComplementaires();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la création';
      setCompError(msg);
    } finally {
      setCompLoading(false);
    }
  };

  const handleFacturerComplementaire = async (devisId: string) => {
    setCompFacturerLoading(devisId);
    try {
      await emettreFactureTotal(devisId);
      await loadComplementaires();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la facturation';
      onError(msg);
    } finally {
      setCompFacturerLoading(null);
    }
  };

  const renderDevisComplementaires = () => {
    if (!isDirect || user.role !== 'HEBERGEUR') return null;
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Devis complémentaires</h3>
          <button
            onClick={() => { resetCompForm(); setShowModalComplementaire(true); }}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            + Ajouter un devis
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Payeurs additionnels (Association sportive, Mairie, CE…) — chacun reçoit sa propre facture à son nom.
        </p>

        {complementairesLoading ? (
          <div className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : complementaires.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Aucun devis complémentaire.</p>
        ) : (
          <div className="space-y-2">
            {complementaires.map((c) => {
              const facts = compFacturesMap[c.id] ?? [];
              const dejaFacture = facts.some(f => f.typeFacture === 'SOLDE' || f.typeFacture === 'ACOMPTE');
              const annule = c.statut === 'NON_RETENU';
              return (
                <div key={c.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.destinataireNom ?? 'Destinataire'}
                        {c.numeroDevis ? <span className="text-gray-400 font-normal"> · {c.numeroDevis}</span> : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        {Number(c.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC
                        {c.description ? ` · ${c.description}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      annule ? 'bg-gray-100 text-gray-500' : dejaFacture ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {annule ? 'Annulé' : dejaFacture ? 'Facturé' : 'Brouillon'}
                    </span>
                  </div>

                  {(facts.length > 0 || (!dejaFacture && !annule)) && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                      {facts.map((f) => (
                        <FacturePdfLink key={f.id} facture={f} onReload={loadComplementaires} />
                      ))}
                      {!dejaFacture && !annule && (
                        <button
                          onClick={() => handleFacturerComplementaire(c.id)}
                          disabled={compFacturerLoading === c.id}
                          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {compFacturerLoading === c.id && (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          Facturer le total
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFacturationPipeline = () => {
    if (user.role !== 'HEBERGEUR') return null;
    if (!activeDevisForFacturation) return null;
    const FACTURATION_STATUTS = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];
    if (!FACTURATION_STATUTS.includes(activeDevisForFacturation.statut)) return null;

    const ad = activeDevisForFacturation;
    const totalVerse = versements.reduce((sum, v) => sum + v.montant, 0);
    const resteDu = ad.montantTTC - totalVerse;
    const pctVerse = ad.montantTTC > 0 ? Math.min(100, Math.round((totalVerse / ad.montantTTC) * 100)) : 0;
    const avoirSurAcompte = factures.find(f => f.typeFacture === 'AVOIR' && f.factureAnnuleeId === factureAcompte?.id) ?? null;
    const avoirSurSolde = factures.find(f => f.typeFacture === 'AVOIR' && f.factureAnnuleeId === factureSolde?.id) ?? null;

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Facturation</h3>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`h-2.5 w-2.5 rounded-full ${
            etatFacturation === 'AUCUNE' ? 'bg-amber-400' :
            etatFacturation === 'ACOMPTE' ? 'bg-blue-500' :
            'bg-green-500'
          }`} />
          <span className="text-sm text-gray-700">
            {etatFacturation === 'AUCUNE' ? 'En attente d\'acompte' :
             etatFacturation === 'ACOMPTE' ? 'Acompte facturé' :
             'Soldé'}
          </span>
          {factureAcompte && (
            <span className="text-[11px] text-gray-400">· Acompte {factureAcompte.numero}</span>
          )}
          {factureSolde && (
            <span className="text-[11px] text-gray-400">· Solde {factureSolde.numero}</span>
          )}
        </div>

        {(factureAcompte || factureSolde || avoirSurAcompte || avoirSurSolde) && (
          <div className="flex items-center gap-2 flex-wrap">
            {factureAcompte && <FacturePdfLink facture={factureAcompte} onReload={reloadFactures} />}
            {factureSolde && <FacturePdfLink facture={factureSolde} onReload={reloadFactures} />}
            {avoirSurAcompte && <FacturePdfLink facture={avoirSurAcompte} onReload={reloadFactures} />}
            {avoirSurSolde && <FacturePdfLink facture={avoirSurSolde} onReload={reloadFactures} />}
          </div>
        )}

        {[avoirSurAcompte, avoirSurSolde].filter((a): a is Facture => !!a).map((avoir) => (
          <div key={avoir.id} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="font-medium text-red-700">Avoir {avoir.numero}</span>
            <span className="text-red-600">
              −{Math.abs(avoir.montantFacture).toLocaleString('fr-FR', {
                minimumFractionDigits: 2, maximumFractionDigits: 2
              })} €
            </span>
            {avoir.motifAvoir && (
              <span className="text-red-400">· {avoir.motifAvoir}</span>
            )}
          </div>
        ))}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Total TTC</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {ad.montantTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Acompte ({ad.pourcentageAcompte}%)</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {ad.montantAcompte.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Déjà versé</p>
            <p className="text-sm font-semibold text-green-700 mt-0.5">
              {totalVerse.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Reste dû</p>
            <p className="text-sm font-semibold text-amber-700 mt-0.5">
              {resteDu.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Versements</span>
            <span>{pctVerse}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pctVerse}%` }} />
          </div>
        </div>

        {facturesLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        ) : versements.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Versements</p>
            {versements.map(v => (
              <div key={v.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">{new Date(v.datePaiement).toLocaleDateString('fr-FR')}</span>
                  <span className="font-medium text-gray-900">{v.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                  {v.modePaiement && (
                    <span className="text-gray-400">
                      {({
                        VIREMENT: 'Virement',
                        CHEQUE: 'Chèque',
                        CARTE: 'Carte',
                        ESPECES: 'Espèces',
                        CHEQUES_VACANCES: 'Chèques-vacances',
                      } as Record<string, string>)[v.modePaiement] ?? v.modePaiement}
                    </span>
                  )}
                  {v.reference && <span className="text-gray-400">Réf: {v.reference}</span>}
                </div>
                <button
                  onClick={() => handleSupprimerVersement(v)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  title="Supprimer ce versement"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Aucun versement enregistré</p>
        )}

        {showAddVersement && (
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700">Nouveau versement</p>
              {factureActive && (
                <p className="text-[11px] text-gray-500">
                  Montant attendu : <span className="font-semibold text-gray-700">{factureActive.montantFacture.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={versementForm.montant}
                  onChange={e => setVersementForm(f => ({ ...f, montant: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="1440.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={versementForm.datePaiement}
                  onChange={e => setVersementForm(f => ({ ...f, datePaiement: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mode de règlement</label>
                <select
                  value={versementForm.modePaiement}
                  onChange={e => setVersementForm(f => ({ ...f, modePaiement: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  <option value="">— Sélectionner —</option>
                  <option value="VIREMENT">Virement</option>
                  <option value="CHEQUE">Chèque</option>
                  <option value="CARTE">Carte bancaire</option>
                  <option value="ESPECES">Espèces</option>
                  <option value="CHEQUES_VACANCES">Chèques-vacances / ANCV</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Référence</label>
                <input
                  type="text"
                  value={versementForm.reference}
                  onChange={e => setVersementForm(f => ({ ...f, reference: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  placeholder="VIR-2026-001"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddVersement(false); setVersementForm({ montant: '', datePaiement: '', reference: '', modePaiement: '' }); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAjouterVersement}
                disabled={versementSaving || !versementForm.montant || !versementForm.datePaiement}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {versementSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-2">
          {factureActive && resteDu > 0 && (
            <button
              onClick={() => setShowAddVersement(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              + Ajouter un versement
            </button>
          )}
          {etatFacturation === 'AUCUNE' && (
            <>
              <button
                onClick={handleFacturerAcompte}
                disabled={facturerLoading}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {facturerLoading ? 'Facturation...' : `📄 Facturer l'acompte (${ad.pourcentageAcompte}%)`}
              </button>
              <button
                onClick={handleFacturerTotal}
                disabled={facturerLoading}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {facturerLoading ? 'Facturation...' : '📄 Facturer le total'}
              </button>
            </>
          )}
          {etatFacturation === 'ACOMPTE' && (
            <button
              onClick={handleFacturerSolde}
              disabled={facturerLoading || !factureAcompte?.acompteVerse}
              title={!factureAcompte?.acompteVerse ? 'L\'acompte doit être validé avant la facture de solde' : undefined}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {facturerLoading ? 'Facturation...' : '📄 Facturer le solde'}
            </button>
          )}

          {/* Avoir sur l'acompte — si acompte émis et pas encore d'avoir */}
          {factureAcompte && !avoirSurAcompte && (
            <button
              onClick={() => openModalAvoir(factureAcompte)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              {factureSolde ? 'Émettre un avoir (acompte)' : 'Émettre un avoir'}
            </button>
          )}
          {/* Avoir sur le solde — si solde émis et pas encore d'avoir */}
          {factureSolde && !avoirSurSolde && (
            <button
              onClick={() => openModalAvoir(factureSolde)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Émettre un avoir (solde)
            </button>
          )}

          {/* Annuler le devis — DIRECT ou COLLABORATIF, devis sélectionné/signé.
              Si une facture est émise, le backend exige d'abord un avoir (boutons ci-dessus). */}
          {activeDevisStatut && ['SELECTIONNE', 'SIGNE_DIRECTION'].includes(activeDevisStatut) && (
            <button
              onClick={() => setShowModalAnnuler(true)}
              disabled={annulerLoading}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {annulerLoading ? 'Annulation...' : 'Annuler ce devis'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ── Devis DIRECT — rendu dynamique ─── */}
      {isDirect && (
        <div className="space-y-4">
          {directDevisLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : directDevis ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Devis {directDevis.numeroDevis ?? ''}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Créé le {new Date(directDevis.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    etatFacturation === 'SOLDE' ? 'bg-teal-100 text-teal-700' :
                    etatFacturation === 'ACOMPTE' ? 'bg-indigo-100 text-indigo-700' :
                    directDevis.statut === 'EN_ATTENTE' ? 'bg-orange-100 text-orange-700' :
                    directDevis.statut === 'SELECTIONNE' ? 'bg-green-100 text-green-700' :
                    directDevis.statut === 'SIGNE_DIRECTION' ? (isDirect ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700') :
                    directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {etatFacturation === 'SOLDE' ? 'Soldé' :
                     etatFacturation === 'ACOMPTE' ? 'Acompte facturé' :
                     directDevis.statut === 'EN_ATTENTE' ? 'Brouillon' :
                     directDevis.statut === 'SELECTIONNE' ? 'Signé' :
                     directDevis.statut === 'SIGNE_DIRECTION' ? (isDirect ? 'Signé' : 'Signé direction') :
                     directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'En attente direction' :
                     directDevis.statut === 'NON_RETENU' ? 'Non retenu' :
                     directDevis.statut}
                  </span>
                </div>

                {(directDevis.lignes ?? []).length > 0 && (
                  <table className="w-full text-xs mb-4">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Qté</th>
                        <th className="text-right py-2 text-gray-500 font-medium">PU TTC</th>
                        <th className="text-right py-2 text-gray-500 font-medium">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(directDevis.lignes ?? []).map((l, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2">{l.description}</td>
                          <td className="py-2 text-right">{l.quantite}</td>
                          <td className="py-2 text-right">{(l.prixUnitaire + l.prixUnitaire * (l.tva / 100)).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                          <td className="py-2 text-right font-medium">{l.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  {directDevis.montantHT != null && (
                    <div className="flex justify-between"><span className="text-gray-500">HT</span><span>{Number(directDevis.montantHT).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
                  )}
                  {directDevis.montantTVA != null && (
                    <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>{Number(directDevis.montantTVA).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span></div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total TTC</span>
                    <span className="text-[var(--color-primary)]">{Number(directDevis.montantTTC ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                  </div>
                  {directDevis.montantAcompte != null && Number(directDevis.montantAcompte) > 0 && (
                    <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                      <span>Acompte ({directDevis.pourcentageAcompte ?? 30}%)</span>
                      <span className="font-semibold">{Number(directDevis.montantAcompte).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {sejour?.clientEmail && directDevis.statut === 'EN_ATTENTE' && (
                  <button
                    onClick={() => { setMessagePerso(''); setEnvoiError(null); setShowEnvoiModal(true); }}
                    disabled={envoyerLoading}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {envoyerLoading ? 'Envoi en cours…' : `📨 Envoyer à ${sejour.clientEmail}`}
                  </button>
                )}

                {!sejour?.clientEmail && directDevis.statut === 'EN_ATTENTE' && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Renseignez l&apos;email du client pour pouvoir envoyer le devis par email.
                  </p>
                )}

                {envoyerSuccess && (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    ✅ Devis envoyé par email ! Le client recevra un lien pour consulter et signer le devis.
                  </p>
                )}

                {showEnvoiModal && directDevis && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                    onClick={() => { if (!envoyerLoading) setShowEnvoiModal(false); }}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h2 className="text-base font-semibold text-gray-900">
                        Envoyer le devis à{' '}
                        {[sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' ') || 'votre client'}
                      </h2>
                      {sejour?.clientEmail && (
                        <p className="text-xs text-gray-500 mt-0.5">{sejour.clientEmail}</p>
                      )}

                      <div className="mt-4">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Message (optionnel)
                        </label>
                        <textarea
                          autoFocus
                          rows={5}
                          maxLength={2000}
                          value={messagePerso}
                          onChange={(e) => setMessagePerso(e.target.value)}
                          placeholder={`Bonjour ${sejour?.clientPrenom ?? ''},\nVeuillez trouver ci-joint notre devis...`}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {messagePerso.length} / 2000 caractères
                        </p>
                      </div>

                      {sejour?.hebergementSelectionne?.email && (
                        <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                          ℹ️ {sejour?.clientPrenom || 'Le client'} pourra répondre directement par
                          email à {sejour.hebergementSelectionne.email}
                        </p>
                      )}

                      {envoiError && (
                        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                          {envoiError}
                        </div>
                      )}

                      <div className="mt-5 flex justify-end gap-2">
                        <button
                          onClick={() => setShowEnvoiModal(false)}
                          disabled={envoyerLoading}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={async () => {
                            setEnvoyerLoading(true);
                            setEnvoiError(null);
                            try {
                              await envoyerDevisDirect(directDevis.id, messagePerso.trim() || undefined);
                              setShowEnvoiModal(false);
                              setEnvoyerSuccess(true);
                              await reloadAllDirect();
                            } catch {
                              setEnvoiError("Erreur lors de l'envoi du devis. Réessayez.");
                            } finally {
                              setEnvoyerLoading(false);
                            }
                          }}
                          disabled={envoyerLoading}
                          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        >
                          {envoyerLoading && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          )}
                          {envoyerLoading ? 'Envoi en cours…' : 'Envoyer le devis'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {['EN_ATTENTE', 'EN_ATTENTE_VALIDATION'].includes(directDevis.statut) && (
                  <Link
                    href={`/dashboard/hebergeur/devis/${directDevis.id}/modifier`}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Modifier le devis
                  </Link>
                )}
              </div>

              {/* Bloc « Devis signé » — affiché dès lors que le devis est signé
                  (en ligne OU scan uploadé). Le scan ne renseigne pas le nom du
                  signataire : on retombe alors sur la date seule. */}
              {(directDevis.statut === 'SELECTIONNE' || directDevis.statut === 'SIGNE_DIRECTION')
                && (directDevis.nomSignataireDirecteur || directDevis.dateSignatureDirecteur) && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-green-800">✅ Devis signé</p>
                  <p className="text-xs text-green-700 mt-1">
                    {directDevis.nomSignataireDirecteur
                      ? `Signé par ${directDevis.nomSignataireDirecteur}`
                      : 'Document signé'}
                    {directDevis.dateSignatureDirecteur && (
                      ` le ${new Date(directDevis.dateSignatureDirecteur).toLocaleDateString('fr-FR')} à ${new Date(directDevis.dateSignatureDirecteur).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                    )}
                  </p>
                </div>
              )}

              {/* Convention de séjour scolaire — DIRECT + nature SEJOUR + devis signé */}
              {sejour?.natureSejour === 'SEJOUR'
                && ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'].includes(directDevis.statut) && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Convention de séjour</h3>
                  </div>

                  {directDevis.conventionUrl && (
                    <a
                      href={directDevis.conventionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] underline hover:opacity-80"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      📄 Télécharger la convention
                    </a>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => handlePreviewConvention(directDevis.id)}
                      disabled={previewLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {previewLoading && (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                      )}
                      {previewLoading ? 'Ouverture…' : '👁 Prévisualiser'}
                    </button>
                    <button
                      onClick={() => handleGenererConvention(directDevis.id, sejour?.clientEmail)}
                      disabled={conventionLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#1B4060] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {conventionLoading && (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      )}
                      {conventionLoading ? 'Envoi…' : directDevis.conventionUrl ? '📤 Renvoyer au client' : '📤 Envoyer au client'}
                    </button>
                  </div>

                  {conventionSuccess && (
                    <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                      ✅ Convention générée et envoyée par email
                    </p>
                  )}
                </div>
              )}

              {/* Aperçu PDF du devis (signé ou non) — au-dessus de la section Facturation */}
              {(() => {
                const dd = directDevis!;
                const cc = dd.centre;
                const htCalc = Number(dd.montantHT) || (dd.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
                const ttcCalc = Number(dd.montantTTC) || Number(dd.montantTotal) || 0;
                const tvaCalc = Number(dd.montantTVA) || (ttcCalc - htCalc);
                const pdfPropsDirect: DevisPDFProps = {
                  typeDocument: 'DEVIS',
                  numeroDocument: dd.numeroDevis ?? `DEV-${dd.id.substring(0, 8).toUpperCase()}`,
                  dateDocument: dd.createdAt,
                  dateValidite: new Date(new Date(dd.createdAt).getTime() + 30 * 86400000).toISOString(),
                  nomEmetteur: dd.nomEntreprise || cc?.nom || '',
                  adresseEmetteur: dd.adresseEntreprise || [cc?.adresse, cc?.codePostal, cc?.ville].filter(Boolean).join(', '),
                  siretEmetteur: dd.siretEntreprise || cc?.siret || undefined,
                  emailEmetteur: dd.emailEntreprise || cc?.email || undefined,
                  telEmetteur: dd.telEntreprise || cc?.telephone || undefined,
                  tvaEmetteur: cc?.tvaIntracommunautaire ?? undefined,
                  ibanEmetteur: cc?.iban ?? undefined,
                  nomDestinataire: [sejour?.clientPrenom, sejour?.clientNom].filter(Boolean).join(' '),
                  etablissementNom: sejour?.clientOrganisation ?? undefined,
                  adresseDestinataire:
                    [
                      sejour?.clientAdresse,
                      [sejour?.clientCodePostal, sejour?.clientVille].filter(Boolean).join(' '),
                    ]
                      .filter(Boolean)
                      .join(', ') || undefined,
                  emailDestinataire: sejour?.clientEmail ?? undefined,
                  telDestinataire: sejour?.clientTelephone ?? undefined,
                  titreSejour: sejour?.titre ?? '',
                  lieuSejour: sejour?.lieu ?? '',
                  dateDebutSejour: sejour?.dateDebut ?? undefined,
                  dateFinSejour: sejour?.dateFin ?? undefined,
                  nombreEleves: sejour?.placesTotales ?? undefined,
                  nombreAccompagnateurs: sejour?.nombreAccompagnateurs ?? undefined,
                  lignes: (dd.lignes ?? []).map((l) => ({
                    description: l.description,
                    quantite: Number(l.quantite),
                    prixUnitaire: Number(l.prixUnitaire),
                    tva: Number(l.tva),
                    totalHT: Number(l.totalHT),
                    totalTTC: Number(l.totalTTC),
                  })),
                  montantHT: htCalc,
                  montantTVA: tvaCalc,
                  montantTTC: ttcCalc,
                  montantAcompte: Number(dd.montantAcompte) || undefined,
                  montantSolde: Number(dd.montantSolde) || undefined,
                  pourcentageAcompte: Number(dd.pourcentageAcompte) || undefined,
                  conditionsAnnulation: dd.conditionsAnnulation ?? undefined,
                  signatureDirecteur: dd.signatureDirecteur ?? null,
                  logoUrl: dd.centre?.logoUrl ?? null,
                };
                return (
                  <div className="space-y-3">
                    <DevisPDFButton
                      data={pdfPropsDirect}
                      filename={`devis-${(dd.numeroDevis ?? dd.id.substring(0, 8)).toLowerCase()}.pdf`}
                      label="Voir et imprimer le devis"
                    />
                    {dd.documentUrl ? (
                      <div className="space-y-3">
                        <a
                          href={dd.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Télécharger le devis PDF
                        </a>
                        <iframe
                          src={dd.documentUrl}
                          className="w-full rounded-2xl border border-gray-200 shadow-sm"
                          style={{ height: '80vh', minHeight: 600 }}
                          title="Aperçu du devis"
                        />
                      </div>
                    ) : (
                      <DevisPDFInline data={pdfPropsDirect} />
                    )}
                  </div>
                );
              })()}

              {renderFacturationPipeline()}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Devis</h3>
              <p className="text-xs text-gray-500 mb-4">Créez un devis pour ce séjour et envoyez-le au client pour signature.</p>
              <Link
                href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${sejourId}`}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
              >
                Créer un devis
              </Link>
            </div>
          )}
          {renderDevisComplementaires()}
        </div>
      )}

      {/* ── Devis collaboratif ─── */}
      {!isDirect && (
        <div>
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
            const htCalc = Number(d.montantHT) || d.lignes.reduce((sum: number, l: any) => sum + Number(l.totalHT), 0);
            const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
            const tvaCalc = Number(d.montantTVA) || (ttcCalc - htCalc);

            const pdfProps: DevisPDFProps = {
              typeDocument: 'DEVIS',
              numeroDocument: d.numeroDevis ?? `DEV-${d.id.substring(0, 8).toUpperCase()}`,
              dateDocument: d.createdAt,
              dateValidite: new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString(),
              nomEmetteur: d.nomEntreprise || c?.nom || '',
              adresseEmetteur: d.adresseEntreprise || [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', '),
              siretEmetteur: d.siretEntreprise || c?.siret || undefined,
              emailEmetteur: d.emailEntreprise || c?.email || undefined,
              telEmetteur: d.telEntreprise || c?.telephone || undefined,
              tvaEmetteur: c?.tvaIntracommunautaire ?? undefined,
              ibanEmetteur: c?.iban ?? undefined,
              nomDestinataire: createur ? `${createur.prenom} ${createur.nom}` : '',
              etablissementNom: createur?.memberships?.[0]?.organisation.nom ?? undefined,
              adresseDestinataire: createur?.memberships?.[0]?.organisation.ville ?? undefined,
              emailDestinataire: createur?.email ?? undefined,
              telDestinataire: createur?.telephone ?? undefined,
              titreSejour: s?.titre ?? '',
              lieuSejour: s?.lieu ?? '',
              dateDebutSejour: s?.dateDebut ?? undefined,
              dateFinSejour: s?.dateFin ?? undefined,
              nombreEleves: s?.placesTotales ?? undefined,
              nombreAccompagnateurs: s?.nombreAccompagnateurs ?? undefined,
              niveauClasse: s?.niveauClasse ?? undefined,
              lignes: d.lignes.map((l: any) => ({
                description: l.description,
                quantite: Number(l.quantite),
                prixUnitaire: Number(l.prixUnitaire),
                tva: Number(l.tva),
                totalHT: Number(l.totalHT),
                totalTTC: Number(l.totalTTC),
              })),
              montantHT: htCalc,
              montantTVA: tvaCalc,
              montantTTC: ttcCalc,
              montantAcompte: Number(d.montantAcompte) || undefined,
              montantSolde: Number(d.montantSolde) || undefined,
              pourcentageAcompte: Number(d.pourcentageAcompte) || undefined,
              conditionsAnnulation: d.conditionsAnnulation ?? undefined,
              signatureDirecteur: d.signatureDirecteur ?? null,
              logoUrl: c?.logoUrl ?? null,
            };

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <DevisPDFButton
                      data={pdfProps}
                      filename={`devis-${pdfProps.numeroDocument}.pdf`}
                      label="Télécharger le devis"
                    />
                    {user.role === 'ORGANISATEUR' && d.statut === 'SELECTIONNE' && !d.signatureDirecteur && (
                      <>
                        <button
                          onClick={() => { setShowInvitationDirection(true); setInvitationSent(false); setInvitationEmail(''); }}
                          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                          Envoyer à la direction pour signature
                        </button>
                        <button
                          onClick={() => signatureFileRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.122 2.122l7.81-7.81" />
                          </svg>
                          Joindre un document signé (scan)
                        </button>
                        <input
                          ref={signatureFileRef}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const formData = new FormData();
                            formData.append('file', file);
                            try {
                              await api.post(`/devis/${d.id}/upload-signature`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' },
                              });
                              await onBudgetReload();
                            } catch (err) {
                              console.error('[upload-signature]', err);
                              onError('Une erreur est survenue. Veuillez réessayer.');
                            } finally {
                              if (signatureFileRef.current) signatureFileRef.current.value = '';
                            }
                          }}
                        />
                      </>
                    )}
                    {d.signatureDirecteur && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-medium text-purple-700">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Signé par la direction
                        {d.nomSignataireDirecteur && <> — {d.nomSignataireDirecteur}</>}
                        {d.dateSignatureDirecteur && <> le {new Date(d.dateSignatureDirecteur).toLocaleDateString('fr-FR')}</>}
                      </span>
                    )}
                    {d.signatureDocumentUrl && (
                      <a
                        href={d.signatureDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50"
                      >
                        Voir le document signé
                      </a>
                    )}
                  </div>
                  {user.role === 'HEBERGEUR' && ['EN_ATTENTE', 'EN_ATTENTE_VALIDATION'].includes(d.statut) && (
                    <a
                      href={`/dashboard/hebergeur/devis/${d.id}/modifier`}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                      Modifier le devis
                    </a>
                  )}
                </div>
                {d.documentUrl ? (
                  <div className="space-y-3">
                    <a
                      href={d.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Télécharger le devis PDF
                    </a>
                    <iframe
                      src={d.documentUrl}
                      className="w-full rounded-2xl border border-gray-200 shadow-sm"
                      style={{ height: '80vh', minHeight: 600 }}
                      title="Aperçu du devis"
                    />
                  </div>
                ) : (
                  <DevisPDFInline data={pdfProps} />
                )}

                {/* Bloc « Devis signé » — COLLABORATIF, côté hébergeur. Affiché dès
                    lors que le devis est signé (en ligne OU scan uploadé : le scan
                    ne renseigne pas le nom → date seule). */}
                {user.role === 'HEBERGEUR'
                  && (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION')
                  && (d.nomSignataireDirecteur || d.dateSignatureDirecteur) && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                    <p className="text-sm font-semibold text-green-800">✅ Devis signé</p>
                    <p className="text-xs text-green-700 mt-1">
                      {d.nomSignataireDirecteur
                        ? `Signé par ${d.nomSignataireDirecteur}`
                        : 'Document signé'}
                      {d.dateSignatureDirecteur && (
                        ` le ${new Date(d.dateSignatureDirecteur).toLocaleDateString('fr-FR')} à ${new Date(d.dateSignatureDirecteur).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      )}
                    </p>
                  </div>
                )}

                {/* Convention de séjour scolaire — COLLABORATIF + nature SEJOUR + devis signé */}
                {sejour?.natureSejour === 'SEJOUR'
                  && user.role === 'HEBERGEUR'
                  && ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'].includes(d.statut) && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900">Convention de séjour</h3>
                    </div>

                    {d.conventionUrl && (
                      <a
                        href={d.conventionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] underline hover:opacity-80"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        📄 Télécharger la convention
                      </a>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => handlePreviewConvention(d.id)}
                        disabled={previewLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {previewLoading && (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                        )}
                        {previewLoading ? 'Ouverture…' : '👁 Prévisualiser'}
                      </button>
                      <button
                        onClick={() => handleGenererConvention(d.id, createur?.email)}
                        disabled={conventionLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#1B4060] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {conventionLoading && (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        )}
                        {conventionLoading ? 'Envoi…' : d.conventionUrl ? '📤 Renvoyer au client' : '📤 Envoyer au client'}
                      </button>
                    </div>

                    {conventionSuccess && (
                      <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        ✅ Convention générée et envoyée par email
                      </p>
                    )}
                  </div>
                )}

                {/* Convention — lien lecture seule pour l'enseignant (ORGANISATEUR / SIGNATAIRE).
                    Affiché uniquement si l'hébergeur a déjà généré la convention. */}
                {(user.role === 'ORGANISATEUR' || user.role === 'SIGNATAIRE') && d.conventionUrl && (
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Convention de séjour</h3>
                    <a
                      href={d.conventionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      📄 Convention séjour scolaire
                    </a>
                  </div>
                )}

                {renderFacturationPipeline()}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Modale invitation direction ─── */}
      {showInvitationDirection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowInvitationDirection(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            {invitationSent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-50">
                  <svg className="h-7 w-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Invitation envoyée</h3>
                <p className="text-sm text-gray-500 mb-6">
                  La direction recevra un email avec un lien pour consulter et signer le devis.
                </p>
                <button
                  onClick={() => setShowInvitationDirection(false)}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Envoyer le devis pour signature</h3>
                <p className="text-sm text-gray-500 mb-4">
                  La direction recevra un email avec un lien pour consulter et signer le devis.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de la direction</label>
                    <input
                      type="email"
                      value={invitationEmail}
                      onChange={(e) => setInvitationEmail(e.target.value)}
                      placeholder="direction@etablissement.fr"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={invitationSending}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => setShowInvitationDirection(false)}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      disabled={invitationSending}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={async () => {
                        if (!invitationEmail.trim() || !sejour || !budgetData?.devis) return;
                        setInvitationSending(true);
                        try {
                          await api.post('/invitations-directeur', {
                            sejourId: sejour.id,
                            devisId: budgetData.devis.id,
                            emailDirecteur: invitationEmail.trim(),
                            enseignantPrenom: user.firstName,
                            sejourTitre: sejour.titre,
                            etablissementNom: user.organisation?.nom ?? '',
                            etablissementUai: user.organisation?.uai ?? '',
                            organisationId: user.organisation?.id ?? undefined,
                            typeContexte: 'SCOLAIRE',
                          });
                          setInvitationSent(true);
                        } catch (err) {
                          console.error('[invitations-directeur]', err);
                          onError('Une erreur est survenue. Veuillez réessayer.');
                        } finally {
                          setInvitationSending(false);
                        }
                      }}
                      disabled={invitationSending || !invitationEmail.trim()}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {invitationSending ? 'Envoi...' : 'Envoyer l\'invitation'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modale avoir ─── */}
      {/* ── Modale double-confirmation annulation devis ─── */}
      {showModalAnnuler && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !annulerLoading && setShowModalAnnuler(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Annuler ce devis ?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous certain de vouloir annuler ce devis ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowModalAnnuler(false)}
                disabled={annulerLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler — revenir
              </button>
              <button
                onClick={handleAnnulerDevis}
                disabled={annulerLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {annulerLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModalAvoir && avoirFactureSource && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowModalAvoir(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-bold text-gray-900">Émettre un avoir</h3>
              <p className="text-sm text-gray-500 mt-1">
                Annule partiellement ou totalement la facture {avoirFactureSource.numero}
              </p>
            </div>

            {/* Liste des lignes */}
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Lignes à inclure dans l'avoir</p>
              {avoirLignes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune ligne disponible</p>
              ) : (
                <div className="space-y-1">
                  {avoirLignes.map((l, i) => (
                    <label
                      key={i}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors ${
                        l.selected
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-gray-50 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={l.selected}
                        onChange={() => handleToggleLigneAvoir(i)}
                        className="rounded"
                      />
                      <span className="flex-1 text-gray-700">{l.description}</span>
                      <span className="text-gray-500">{l.quantite} × {l.prixUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                      <span className="font-semibold text-red-600 min-w-[70px] text-right">
                        {l.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Récapitulatif montant */}
            <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <span className="text-sm font-medium text-red-700">Montant de l'avoir</span>
              <span className="text-lg font-bold text-red-700">
                −{avoirMontant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>

            {/* Motif */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Motif <span className="text-red-500">*</span>
              </label>
              <textarea
                value={avoirMotif}
                onChange={(e) => setAvoirMotif(e.target.value)}
                rows={2}
                placeholder="Ex : annulation d'une activité, réduction suite à effectif moindre…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>

            {avoirError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{avoirError}</p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowModalAvoir(false)}
                disabled={avoirLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitAvoir}
                disabled={avoirLoading || avoirMontant <= 0 || !avoirMotif.trim()}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {avoirLoading ? 'Émission...' : 'Émettre l\'avoir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal création devis complémentaire ─── */}
      {showModalComplementaire && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !compLoading && setShowModalComplementaire(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Nouveau devis complémentaire</h2>
            <p className="text-xs text-gray-400 mb-4">Payeur additionnel facturé à son propre nom.</p>

            {compError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{compError}</div>
            )}

            {/* Destinataire */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rechercher l&apos;organisme payeur</label>
                <OrganisationSearch onSelect={handleSelectCompOrg} placeholder="Association, mairie, entreprise..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom du destinataire *</label>
                <input value={compForm.destinataireNom} onChange={e => setCompForm(f => ({ ...f, destinataireNom: e.target.value }))}
                  className={inputCls} placeholder="ex: Association Sportive du Lycée" />
              </div>
              <input value={compForm.destinataireAdresse} onChange={e => setCompForm(f => ({ ...f, destinataireAdresse: e.target.value }))} className={inputCls} placeholder="Adresse" />
              <div className="grid grid-cols-3 gap-3">
                <input value={compForm.destinataireCodePostal} onChange={e => setCompForm(f => ({ ...f, destinataireCodePostal: e.target.value }))} className={inputCls} placeholder="Code postal" />
                <input value={compForm.destinataireVille} onChange={e => setCompForm(f => ({ ...f, destinataireVille: e.target.value }))} className={`col-span-2 ${inputCls}`} placeholder="Ville" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={compForm.destinataireSiret} onChange={e => setCompForm(f => ({ ...f, destinataireSiret: e.target.value }))} className={inputCls} placeholder="SIRET (optionnel)" />
                <input value={compForm.destinataireEmail} onChange={e => setCompForm(f => ({ ...f, destinataireEmail: e.target.value }))} className={inputCls} placeholder="Email (pour la facture)" />
              </div>
            </div>

            {/* Lignes */}
            <div className="mt-5 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">Prestations</p>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">TVA</label>
                  <select value={compForm.tauxTva} onChange={e => setCompForm(f => ({ ...f, tauxTva: Number(e.target.value) }))}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs">
                    <option value={0}>0 %</option>
                    <option value={5.5}>5,5 %</option>
                    <option value={10}>10 %</option>
                    <option value={20}>20 %</option>
                  </select>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium w-16 text-right">Qté</th>
                    <th className="py-1 font-medium w-24 text-right">PU HT</th>
                    <th className="py-1 font-medium w-24 text-right">Total TTC</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {calcCompTotaux().map((l, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <input value={compForm.lignes[i].description} onChange={e => updateCompLigne(i, 'description', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1" placeholder="ex: Activités ski" />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} value={compForm.lignes[i].quantite} onChange={e => updateCompLigne(i, 'quantite', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} step="0.01" value={compForm.lignes[i].prixUnitaire} onChange={e => updateCompLigne(i, 'prixUnitaire', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                      </td>
                      <td className="py-1 text-right font-medium">{l.totalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
                      <td className="py-1 text-center">
                        {compForm.lignes.length > 1 && (
                          <button onClick={() => removeCompLigne(i)} className="text-red-400 hover:text-red-600" title="Supprimer">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addCompLigne} className="mt-2 text-xs text-[var(--color-primary)] hover:underline">+ Ajouter une ligne</button>

              <div className="mt-3 flex justify-end">
                <div className="text-sm font-bold">
                  Total TTC : <span className="text-[var(--color-primary)]">{compTotalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleCreerComplementaire} disabled={compLoading}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {compLoading ? 'Création…' : 'Créer le devis complémentaire'}
              </button>
              <button onClick={() => setShowModalComplementaire(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
