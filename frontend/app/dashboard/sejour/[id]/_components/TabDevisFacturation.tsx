'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  getDevisForSejour,
  getDevisComplementairesForSejour,
  createDevisComplementaire,
  updateDevis,
  renvoyerDevis,
  emettreFactureAcompte,
  emettreFactureSolde,
  emettreFactureTotal,
  ajouterVersement,
  getFacturesForDevis,
  supprimerVersement,
  regenererFacturePdf,
  emettreAvoir,
  annulerDevis,
  envoyerFactureParEmail,
} from '@/src/lib/devis';
import type { Devis as DevisType, Facture, VersementPaiement } from '@/src/lib/devis';
import OrganisationSearch from '@/src/components/OrganisationSearch';
import type { OrganisationResult } from '@/src/components/OrganisationSearch';
import CatalogueSuggestionInput from '@/src/components/CatalogueSuggestionInput';
import { getCatalogue } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';
import { round2, resolvePrixCatalogueTTC, formatMontant } from '@/src/lib/devis-calculs';
import { resolveClientEtablissement } from '@/src/lib/client-etablissement';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import SecureFileLink from '@/src/components/SecureFileLink';
import api from '@/src/lib/api';
import { extractApiError } from '@/src/contexts/AuthContext';
import type { SejourCollabInfo, BudgetData } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import BlocDevisSigne from './devis-facturation/BlocDevisSigne';
import BlocContratEvenement from './devis-facturation/BlocContratEvenement';
import BlocConvention from './devis-facturation/BlocConvention';
import MarquerSignePanel from './devis-facturation/MarquerSignePanel';
import DevisPdfViewer from './devis-facturation/DevisPdfViewer';
import VueOrganisateur from './devis-facturation/VueOrganisateur';

interface TabDevisFacturationProps {
  sejourId: string;
  sejour: SejourCollabInfo;
  user: User;
  isDirect: boolean;
  budgetData: BudgetData | null;
  onError: (message: string) => void;
  // Rechargement après signature côté ORGANISATEUR (recharge budgetData depuis le parent —
  // reloadDevis/getDevisForSejour est hébergeur-only).
  onReload?: () => Promise<void>;
  // Gating UI par module (calculé côté page depuis sejour.mesPermissions).
  // devis est toujours ≥ READ dans ce composant (l'onglet est masqué si NONE),
  // donc peutEcrireDevis = devis:WRITE. Facturation : NONE/READ/WRITE coexistent.
  peutEcrireDevis: boolean;
  peutEcrireFacturation: boolean;
  peutVoirFacturation: boolean;
}

/**
 * Lien de téléchargement du PDF d'une facture (généré serveur, stocké sur OVH).
 * - pdfUrl présent → lien direct vers l'URL OVH publique (pas d'auth requise).
 * - pdfUrl null (génération échouée) → bouton « Régénérer le PDF ».
 */
function FacturePdfLink({ facture, onReload, peutEcrireFacturation = false }: { facture: Facture; onReload: () => Promise<void>; peutEcrireFacturation?: boolean }) {
  const [regenerating, setRegenerating] = useState(false);
  const label =
    facture.typeFacture === 'ACOMPTE' ? "Facture d'acompte"
    : facture.typeFacture === 'SOLDE' ? 'Facture de solde'
    : "Facture d'avoir";

  if (facture.pdfUrl) {
    return (
      <SecureFileLink
        url={facture.pdfUrl}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {label} — {facture.numero}
      </SecureFileLink>
    );
  }

  // PDF absent (génération échouée) : la facture existe et reste visible en lecture.
  // Sans droit facturation, on affiche un libellé inerte plutôt que le bouton d'action.
  if (!peutEcrireFacturation) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-400"
        title="Le PDF n'a pas encore été généré"
      >
        {label} — PDF indisponible
      </span>
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
  budgetData,
  onError,
  onReload,
  peutEcrireDevis,
  peutEcrireFacturation,
  peutVoirFacturation,
}: TabDevisFacturationProps) {
  // ── Devis DIRECT ────────────────────────────────────────────
  const [devis, setDevis] = useState<DevisType | null>(null);
  const [devisLoading, setDevisLoading] = useState(false);
  const [envoyerLoading, setEnvoyerLoading] = useState(false);
  const [envoyerSuccess, setEnvoyerSuccess] = useState(false);
  const [showEnvoiModal, setShowEnvoiModal] = useState(false);
  const [messagePerso, setMessagePerso] = useState('');
  const [envoiError, setEnvoiError] = useState<string | null>(null);

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
    description: string; prixUnitaire: number; tva: number;
    quantiteMax: number; quantiteAnnulee: number;
    totalHTorig: number; totalTTCorig: number; selected: boolean;
  }>>([]);
  const [avoirLoading, setAvoirLoading] = useState(false);
  const [avoirError, setAvoirError] = useState<string | null>(null);
  const [annulerLoading, setAnnulerLoading] = useState(false);
  const [showModalAnnuler, setShowModalAnnuler] = useState(false);

  // ── Modale envoi facture par email ────────────────────────
  const [showEnvoiFactureModal, setShowEnvoiFactureModal] = useState(false);
  const [envoiFactureTarget, setEnvoiFactureTarget] = useState<Facture | null>(null);
  const [envoiFactureEmail, setEnvoiFactureEmail] = useState('');
  const [envoiFactureMessage, setEnvoiFactureMessage] = useState('');
  const [envoiFactureLoading, setEnvoiFactureLoading] = useState(false);
  const [envoiFactureSuccess, setEnvoiFactureSuccess] = useState(false);

  // ── Devis complémentaires ────────────────────────────────────────────────
  const [complementaires, setComplementaires] = useState<DevisType[]>([]);
  const [complementairesLoading, setComplementairesLoading] = useState(false);
  const [showModalComplementaire, setShowModalComplementaire] = useState(false);
  const [editingComplementaireId, setEditingComplementaireId] = useState<string | null>(null);
  const [compForm, setCompForm] = useState({
    destinataireNom: '',
    destinataireAdresse: '',
    destinataireCodePostal: '',
    destinataireVille: '',
    destinataireSiret: '',
    destinataireEmail: '',
    description: '',
    lignes: [{ description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0, produitCatalogueId: undefined as string | undefined }],
  });
  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [compLoading, setCompLoading] = useState(false);
  const [compError, setCompError] = useState<string | null>(null);
  const [compFacturerLoading, setCompFacturerLoading] = useState<string | null>(null); // id du devis en cours
  const [compFacturesMap, setCompFacturesMap] = useState<Record<string, Facture[]>>({}); // devisId → factures
  const [compSelectedOrg, setCompSelectedOrg] = useState<OrganisationResult | null>(null);

  const loadComplementaires = useCallback(async () => {
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
  }, [sejourId]);

  /** Recharge le devis principal : HEBERGEUR → getDevisForSejour ; sinon → onReload parent. */
  const reloadDevis = async () => {
    if (user.role === 'HEBERGEUR') {
      const d = await getDevisForSejour(sejourId);
      setDevis(d);
    } else {
      await onReload?.();
    }
  };

  useEffect(() => {
    if (user.role !== 'HEBERGEUR') return; // ORGANISATEUR : le devis vient de budgetData
    setDevisLoading(true);
    getDevisForSejour(sejourId)
      .then(d => setDevis(d))
      .catch(() => {})
      .finally(() => setDevisLoading(false));
  }, [sejourId, user.role]);

  // Gate anti-phishing : tant que le centre est en validation (envoisBloques),
  // le backend n'autorise l'envoi de devis que vers l'adresse du compte.
  // Défaut false = rien affiché si l'appel échoue (le backend reste l'autorité).
  const [envoisBloques, setEnvoisBloques] = useState(false);
  useEffect(() => {
    if (user.role !== 'HEBERGEUR') return; // endpoint hébergeur-only ; lu seulement dans la modale d'envoi
    api.get('/centres/onboarding-status')
      .then(({ data }) => setEnvoisBloques(!!data.envoisBloques))
      .catch(() => setEnvoisBloques(false));
  }, [user.role]);

  useEffect(() => {
    loadComplementaires();
  }, [sejourId, loadComplementaires]);

  // Catalogue produits pour l'autocomplete des lignes (HEBERGEUR uniquement, comme le devis principal).
  useEffect(() => {
    getCatalogue().then(setCatalogue).catch(() => {});
  }, []);

  // Devis actif (DIRECT ou COLLAB) normalisé pour le pipeline facturation
  const activeDevisForFacturation = devis
    ? {
        id: devis.id,
        statut: devis.statut,
        montantTTC: Number(devis.montantTTC ?? 0),
        montantAcompte: Number(devis.montantAcompte ?? 0),
        pourcentageAcompte: Number(devis.pourcentageAcompte ?? 30),
        factures: devis.factures ?? null,
      }
    : null;

  const activeDevisId = activeDevisForFacturation?.id ?? null;
  const activeDevisStatut = activeDevisForFacturation?.statut ?? null;

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
    // Toujours recharger via l'API (source de vérité) — pas de short-circuit avec
    // les factures du devis initial, potentiellement stales après un versement.
    setFacturesLoading(true);
    getFacturesForDevis(activeDevisId)
      .then(setFactures)
      .catch(() => {})
      .finally(() => setFacturesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevisId, activeDevisStatut]);

  // Factures dérivées
  // B2 : une facture est « intégralement annulée » si son avoir 1-1 couvre exactement
  // son montant (un avoir PARTIEL la laisse ACTIVE). Miroir du backend estIntegralementAnnulee.
  const estIntegralementAnnulee = (f: Facture): boolean =>
    !!f.avoirAssocie &&
    Math.round(Math.abs(f.avoirAssocie.montantFacture) * 100) === Math.round(f.montantFacture * 100);
  // Facture ACTIVE la plus récente (dateEmission) du type — après une ré-émission,
  // l'ancienne facture intégralement annulée est ignorée.
  const plusRecenteActive = (type: 'ACOMPTE' | 'SOLDE'): Facture | null =>
    factures
      .filter(f => f.typeFacture === type && !estIntegralementAnnulee(f))
      .sort((a, b) => new Date(b.dateEmission).getTime() - new Date(a.dateEmission).getTime())[0] ?? null;
  const factureAcompte = plusRecenteActive('ACOMPTE');
  const factureSolde = plusRecenteActive('SOLDE');
  const etatFacturation: 'AUCUNE' | 'ACOMPTE' | 'SOLDE' =
    factureSolde ? 'SOLDE' : factureAcompte ? 'ACOMPTE' : 'AUCUNE';
  // Facture active la plus récente (solde si présent, sinon acompte) — fallback suppression versement.
  const factureActive = factureSolde ?? factureAcompte;
  // Cible du prochain versement — miroir du routage backend : parmi les factures ACTIVES
  // (hors avoirs + hors intégralement annulées), la 1re non soldée, sinon la dernière.
  const facturesPayables = factures.filter(f => f.typeFacture !== 'AVOIR' && !estIntegralementAnnulee(f));
  const factureCibleVersement =
    facturesPayables.find(f => (f.montantVerseTotal ?? 0) < f.montantFacture * 0.99)
    ?? facturesPayables[facturesPayables.length - 1]
    ?? null;
  const versements: VersementPaiement[] = factures.flatMap(f => f.versements ?? []);

  const handleFacturerAcompte = async () => {
    if (!activeDevisId) return;
    setFacturerLoading(true);
    try {
      await emettreFactureAcompte(activeDevisId);
      await reloadDevis();
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
      await reloadDevis();
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
      await reloadDevis();
      await reloadFactures();
    } catch {
      onError('Erreur lors de la facturation du total');
    } finally {
      setFacturerLoading(false);
    }
  };

  const handleAjouterVersement = async () => {
    if (!activeDevisId || !versementForm.montant || !versementForm.datePaiement) return;
    setVersementSaving(true);
    try {
      await ajouterVersement(
        activeDevisId,
        parseFloat(versementForm.montant),
        versementForm.datePaiement,
        versementForm.reference || undefined,
        versementForm.modePaiement || undefined,
      );
      await reloadFactures();
      // Puis reload du devis pour rafraîchir les montants agrégés (montantVerseTotal) du header.
      await reloadDevis();
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

  // Montant de l'avoir = Σ des sous-totaux TTC prorata des lignes retenues.
  const calcMontantAvoir = (
    lignes: Array<{ selected: boolean; quantiteMax: number; quantiteAnnulee: number; totalTTCorig: number }>,
  ) =>
    round2(
      lignes
        .filter(l => l.selected && l.quantiteMax > 0)
        .reduce((sum, l) => sum + round2(l.totalTTCorig * l.quantiteAnnulee / l.quantiteMax), 0),
    );

  const openModalAvoir = async (fa: Facture) => {
    // Si les lignes ne sont pas chargées, recharger d'abord
    let lignesSource = fa.lignes ?? [];
    if (!lignesSource.length && fa.id) {
      await reloadFactures();
      // Récupérer la FA mise à jour depuis le state
      const faUpdated = factures.find(f => f.id === fa.id);
      lignesSource = faUpdated?.lignes ?? [];
    }
    const lignesMapped = lignesSource.map(l => {
      const quantiteMax = Math.abs(l.quantite);
      return {
        description: l.description,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva,
        quantiteMax,
        quantiteAnnulee: quantiteMax, // pré-rempli à Qmax ⇒ avoir plein par défaut
        totalHTorig: Math.abs(l.totalHT),
        totalTTCorig: Math.abs(l.totalTTC),
        selected: true,
      };
    });
    setAvoirLignes(lignesMapped);
    setAvoirFactureSource(fa);
    setAvoirMontant(calcMontantAvoir(lignesMapped));
    setAvoirMotif('');
    setAvoirError(null);
    setShowModalAvoir(true);
  };

  const handleToggleLigneAvoir = (index: number) => {
    setAvoirLignes(prev => {
      const next = prev.map((l, i) => i === index ? { ...l, selected: !l.selected } : l);
      setAvoirMontant(calcMontantAvoir(next));
      return next;
    });
  };

  const updateQuantiteAvoir = (index: number, value: number) => {
    setAvoirLignes(prev => {
      const next = prev.map((l, i) => {
        if (i !== index) return l;
        if (l.quantiteMax <= 0) return { ...l, quantiteAnnulee: 0 }; // ligne option : non annulable
        const v = Number.isFinite(value) ? value : 0;
        return { ...l, quantiteAnnulee: Math.max(0, Math.min(l.quantiteMax, v)) };
      });
      setAvoirMontant(calcMontantAvoir(next));
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
      .filter(l => l.selected && l.quantiteMax > 0 && l.quantiteAnnulee > 0)
      .map(l => ({
        description: l.description,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva,
        quantite: -l.quantiteAnnulee,
        totalHT: -round2(l.totalHTorig * l.quantiteAnnulee / l.quantiteMax),
        totalTTC: -round2(l.totalTTCorig * l.quantiteAnnulee / l.quantiteMax),
      }));
    const montant = calcMontantAvoir(avoirLignes);
    setAvoirLoading(true);
    setAvoirError(null);
    try {
      await emettreAvoir(avoirFactureSource.id, montant, avoirMotif, lignesSelectionnees);
      setShowModalAvoir(false);
      await reloadFactures();
      await reloadDevis();
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
      await reloadDevis();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de l\'annulation';
      onError(msg);
      setShowModalAnnuler(false);
    } finally {
      setAnnulerLoading(false);
    }
  };

  const handleOpenEnvoiFacture = (facture: Facture) => {
    setEnvoiFactureTarget(facture);
    // Pré-remplir email : priorité facture.destinataireEmail
    setEnvoiFactureEmail(facture.destinataireEmail ?? '');
    // Message par défaut
    const label = facture.typeFacture === 'ACOMPTE' ? "la facture d'acompte"
      : facture.typeFacture === 'AVOIR' ? "l'avoir"
      : 'la facture de solde';
    const montant = facture.montantFacture < 0
      ? `−${Math.abs(facture.montantFacture).toFixed(2).replace('.', ',')} €`
      : `${facture.montantFacture.toFixed(2).replace('.', ',')} €`;
    const titre = (sejour as any).titre ?? 'votre séjour';
    setEnvoiFactureMessage(
      `Bonjour,\n\nVeuillez trouver ci-joint ${label} n°${facture.numero} d'un montant de ${montant} relative au séjour « ${titre} ».\n\nCordialement`
    );
    setEnvoiFactureSuccess(false);
    setShowEnvoiFactureModal(true);
  };

  const handleEnvoiFacture = async () => {
    if (!envoiFactureTarget || !envoiFactureEmail.trim()) return;
    setEnvoiFactureLoading(true);
    try {
      await envoyerFactureParEmail(
        envoiFactureTarget.id,
        envoiFactureEmail.trim(),
        envoiFactureMessage,
      );
      setEnvoiFactureSuccess(true);
      setTimeout(() => setShowEnvoiFactureModal(false), 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? "Erreur lors de l'envoi";
      onError(msg);
    } finally {
      setEnvoiFactureLoading(false);
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
    setCompForm(f => ({ ...f, lignes: [...f.lignes, { description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0, produitCatalogueId: undefined as string | undefined }] }));
  const removeCompLigne = (index: number) =>
    setCompForm(f => ({ ...f, lignes: f.lignes.filter((_, i) => i !== index) }));
  const updateCompLigne = (index: number, field: 'description' | 'quantite' | 'prixUnitaire' | 'tva', value: string) =>
    setCompForm(f => ({
      ...f,
      lignes: f.lignes.map((l, i) => i === index
        ? { ...l, [field]: field === 'description' ? value : Number(value) || 0 }
        : l),
    }));

  /**
   * Sélection d'un produit catalogue : remplit description + prix TTC + TVA de la ligne
   * en un seul setState (sinon les closures React s'écraseraient). Identique au devis principal.
   */
  const selectCompProduit = (index: number, produit: ProduitCatalogue) =>
    setCompForm(f => ({
      ...f,
      lignes: f.lignes.map((l, i) => i === index
        ? {
            ...l,
            description: produit.nom,
            prixUnitaire: resolvePrixCatalogueTTC(produit),
            tva: produit.tva ?? 0,
            produitCatalogueId: produit.id,
          }
        : l),
    }));

  const calcCompTotaux = () => {
    return compForm.lignes.map(l => {
      // L'utilisateur saisit un prix TTC (cohérent avec les autres builders). Le HT est
      // dérivé. prixUnitaire est stocké HT en base (convention backend, RÈGLE 4).
      // TVA par ligne, comme le devis principal.
      const puTTC = l.prixUnitaire;
      const puHT = round2(puTTC / (1 + l.tva / 100));
      const totalTTC = round2(puTTC * l.quantite);
      const totalHT = round2(puHT * l.quantite);
      return { ...l, prixUnitaire: puHT, totalHT, totalTTC };
    });
  };

  const compTotalTTC = round2(calcCompTotaux().reduce((s, l) => s + l.totalTTC, 0));

  const resetCompForm = () => {
    setCompForm({
      destinataireNom: '', destinataireAdresse: '', destinataireCodePostal: '',
      destinataireVille: '', destinataireSiret: '', destinataireEmail: '',
      description: '',
      lignes: [{ description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0, produitCatalogueId: undefined as string | undefined }],
    });
    setEditingComplementaireId(null);
    setCompSelectedOrg(null);
    setCompError(null);
  };

  // Ouvre la modale en mode ÉDITION : pré-remplit compForm depuis le complémentaire.
  // Le champ « PU TTC » est reconstitué depuis totalTTC/quantite (idempotence des arrondis,
  // même convention que la page /devis/[id]/modifier), et NON prixUnitaire×(1+tva).
  const openEditComplementaire = (c: DevisType) => {
    setCompForm({
      destinataireNom: c.destinataireNom ?? '',
      destinataireAdresse: c.destinataireAdresse ?? '',
      destinataireCodePostal: c.destinataireCodePostal ?? '',
      destinataireVille: c.destinataireVille ?? '',
      destinataireSiret: c.destinataireSiret ?? '',
      destinataireEmail: c.destinataireEmail ?? '',
      description: c.description ?? '',
      lignes: (c.lignes && c.lignes.length > 0)
        ? c.lignes.map(l => ({
            description: l.description,
            quantite: l.quantite,
            prixUnitaire: l.quantite > 0
              ? round2(l.totalTTC / l.quantite)
              : round2(l.prixUnitaire * (1 + l.tva / 100)),
            tva: l.tva,
            totalHT: l.totalHT,
            totalTTC: l.totalTTC,
            produitCatalogueId: (l.produitCatalogueId ?? undefined) as string | undefined,
          }))
        : [{ description: '', quantite: 1, prixUnitaire: 0, tva: 0, totalHT: 0, totalTTC: 0, produitCatalogueId: undefined as string | undefined }],
    });
    setEditingComplementaireId(c.id);
    setCompSelectedOrg(null);
    setCompError(null);
    setShowModalComplementaire(true);
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
    // Robustesse : en édition, refuser un complémentaire déjà facturé. Le backend
    // updateDevis autorise EN_ATTENTE (statut inchangé après émission d'une facture),
    // donc le frontend est la seule protection réelle contre l'édition d'un facturé.
    if (editingComplementaireId) {
      const facts = compFacturesMap[editingComplementaireId] ?? [];
      const dejaFacture = facts.some(f => f.typeFacture === 'SOLDE' || f.typeFacture === 'ACOMPTE');
      if (dejaFacture) {
        setCompError('Ce devis a déjà été facturé et ne peut plus être modifié.');
        return;
      }
    }
    // Taux de TVA du devis dérivé en moyenne pondérée des lignes (comme le devis principal).
    const totalHT = lignesCalculees.reduce((s, l) => s + l.totalHT, 0);
    const totalTVA = lignesCalculees.reduce((s, l) => s + (l.totalTTC - l.totalHT), 0);
    const tauxTvaDevis = totalHT > 0 ? round2((totalTVA / totalHT) * 100) : 0;
    setCompLoading(true);
    setCompError(null);
    try {
      if (editingComplementaireId) {
        // Édition : réutilise updateDevis générique. Montants dérivés EXACTEMENT comme
        // createDevisComplementaire (montantTotal=montantTTC, montantParEleve figé à 0,
        // TVA = TTC − HT). demandeId=null ⇒ pas de synchro effectif ni de notif.
        await updateDevis(editingComplementaireId, {
          montantTotal: compTotalTTC.toFixed(2),
          montantParEleve: '0',
          montantHT: round2(totalHT),
          montantTVA: round2(totalTVA),
          montantTTC: compTotalTTC,
          tauxTva: tauxTvaDevis,
          typeDevis: 'COMPLEMENTAIRE',
          description: compForm.description || undefined,
          destinataireNom: compForm.destinataireNom.trim(),
          destinataireAdresse: compForm.destinataireAdresse || undefined,
          destinataireCodePostal: compForm.destinataireCodePostal || undefined,
          destinataireVille: compForm.destinataireVille || undefined,
          destinataireSiret: compForm.destinataireSiret || undefined,
          destinataireEmail: compForm.destinataireEmail || undefined,
          lignes: lignesCalculees,
        });
      } else {
        await createDevisComplementaire({
          sejourDirectId: sejourId,
          destinataireNom: compForm.destinataireNom.trim(),
          destinataireAdresse: compForm.destinataireAdresse || undefined,
          destinataireCodePostal: compForm.destinataireCodePostal || undefined,
          destinataireVille: compForm.destinataireVille || undefined,
          destinataireSiret: compForm.destinataireSiret || undefined,
          destinataireEmail: compForm.destinataireEmail || undefined,
          tauxTva: tauxTvaDevis,
          description: compForm.description || undefined,
          lignes: lignesCalculees,
        });
      }
      setShowModalComplementaire(false);
      resetCompForm();
      await loadComplementaires();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? (editingComplementaireId ? 'Erreur lors de la modification' : 'Erreur lors de la création');
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
    if (user.role !== 'HEBERGEUR') return null;
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Devis complémentaires</h3>
          {peutEcrireDevis && (
            <button
              onClick={() => { resetCompForm(); setShowModalComplementaire(true); }}
              className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              + Ajouter un devis
            </button>
          )}
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
                        {formatMontant(Number(c.montantTTC ?? 0))} € TTC
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
                        <React.Fragment key={f.id}>
                          <FacturePdfLink facture={f} onReload={loadComplementaires} peutEcrireFacturation={peutEcrireFacturation} />
                          {f.pdfUrl && peutEcrireFacturation && (
                            <button
                              onClick={() => handleOpenEnvoiFacture(f)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                              </svg>
                              Envoyer par email
                            </button>
                          )}
                        </React.Fragment>
                      ))}
                      {!dejaFacture && !annule && peutEcrireDevis && (
                        <button
                          onClick={() => openEditComplementaire(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Modifier
                        </button>
                      )}
                      {!dejaFacture && !annule && peutEcrireFacturation && (
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
    if (!peutVoirFacturation) return null;
    if (!activeDevisForFacturation) return null;
    const FACTURATION_STATUTS = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];
    if (!FACTURATION_STATUTS.includes(activeDevisForFacturation.statut)) return null;

    const ad = activeDevisForFacturation;
    const totalVerse = versements.reduce((sum, v) => sum + v.montant, 0);
    // Base unifiée (B1/B2) : sans facture, le TTC du devis ; sinon la somme des
    // montantFacture (les avoirs sont négatifs) = le dû réel après rectifications.
    const base = factures.length === 0
      ? ad.montantTTC
      : round2(factures.reduce((sum, f) => sum + f.montantFacture, 0));
    const resteDu = round2(base - totalVerse);
    const pctVerse = base > 0 ? Math.min(100, Math.round((totalVerse / base) * 100)) : 0;
    const avoirSurAcompte = factures.find(f => f.typeFacture === 'AVOIR' && f.factureAnnuleeId === factureAcompte?.id) ?? null;
    const avoirSurSolde = factures.find(f => f.typeFacture === 'AVOIR' && f.factureAnnuleeId === factureSolde?.id) ?? null;
    // B2 : un bandeau rouge pour CHAQUE avoir + traçabilité des factures intégralement annulées.
    const tousLesAvoirs = factures.filter(f => f.typeFacture === 'AVOIR');
    const facturesAnnulees = factures.filter(f => f.typeFacture !== 'AVOIR' && estIntegralementAnnulee(f));
    const numeroFactureParId = new Map(factures.map(f => [f.id, f.numero]));

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

        {(factureAcompte || factureSolde) && (
          <div className="flex items-center gap-2 flex-wrap">
            {[factureAcompte, factureSolde]
              .filter((f): f is Facture => !!f)
              .map((f) => (
                <React.Fragment key={f.id}>
                  <FacturePdfLink facture={f} onReload={reloadFactures} peutEcrireFacturation={peutEcrireFacturation} />
                  {f.pdfUrl && peutEcrireFacturation && (
                    <button
                      onClick={() => handleOpenEnvoiFacture(f)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                      Envoyer par email
                    </button>
                  )}
                </React.Fragment>
              ))}
          </div>
        )}

        {tousLesAvoirs.map((avoir) => (
          <div key={avoir.id} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-red-400 flex-shrink-0" />
            <span className="font-medium text-red-700">Avoir {avoir.numero}</span>
            <span className="text-red-600">
              −{formatMontant(Math.abs(avoir.montantFacture))} €
            </span>
            {avoir.factureAnnuleeId && numeroFactureParId.get(avoir.factureAnnuleeId) && (
              <span className="text-red-400">· sur {numeroFactureParId.get(avoir.factureAnnuleeId)}</span>
            )}
            {avoir.motifAvoir && (
              <span className="text-red-400">· {avoir.motifAvoir}</span>
            )}
            <span className="ml-auto">
              <FacturePdfLink facture={avoir} onReload={reloadFactures} peutEcrireFacturation={peutEcrireFacturation} />
            </span>
          </div>
        ))}

        {facturesAnnulees.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Documents annulés</p>
            {facturesAnnulees.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">annulée</span>
                <span className="text-gray-600">{f.numero}</span>
                <span className="text-gray-400">{formatMontant(f.montantFacture)} €</span>
                <span className="ml-auto">
                  <FacturePdfLink facture={f} onReload={reloadFactures} peutEcrireFacturation={peutEcrireFacturation} />
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Total TTC</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {formatMontant(ad.montantTTC)} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Acompte ({ad.pourcentageAcompte}%)</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {formatMontant(ad.montantAcompte)} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Déjà versé</p>
            <p className="text-sm font-semibold text-green-700 mt-0.5">
              {formatMontant(totalVerse)} €
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-500">Reste dû</p>
            <p className="text-sm font-semibold text-amber-700 mt-0.5">
              {formatMontant(resteDu)} €
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
                  <span className="font-medium text-gray-900">{formatMontant(v.montant)} €</span>
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
                {peutEcrireFacturation && (
                  <button
                    onClick={() => handleSupprimerVersement(v)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    title="Supprimer ce versement"
                  >
                    ×
                  </button>
                )}
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
              {factureCibleVersement && (
                <p className="text-[11px] text-gray-500">
                  Montant attendu : <span className="font-semibold text-gray-700">{formatMontant(Math.max(0, factureCibleVersement.montantFacture - (factureCibleVersement.montantVerseTotal ?? 0)))} €</span>
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
          {factures.length > 0 && resteDu > 0 && peutEcrireFacturation && (
            <button
              onClick={() => setShowAddVersement(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              + Ajouter un versement
            </button>
          )}
          {etatFacturation === 'AUCUNE' && peutEcrireFacturation && (
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
          {etatFacturation === 'ACOMPTE' && peutEcrireFacturation && (
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
          {factureAcompte && !avoirSurAcompte && peutEcrireFacturation && (
            <button
              onClick={() => openModalAvoir(factureAcompte)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              {factureSolde ? 'Émettre un avoir (acompte)' : 'Émettre un avoir'}
            </button>
          )}
          {/* Avoir sur le solde — si solde émis et pas encore d'avoir */}
          {factureSolde && !avoirSurSolde && peutEcrireFacturation && (
            <button
              onClick={() => openModalAvoir(factureSolde)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Émettre un avoir (solde)
            </button>
          )}

          {/* Annuler le devis — DIRECT ou COLLABORATIF, devis sélectionné/signé.
              Si une facture est émise, le backend exige d'abord un avoir (boutons ci-dessus). */}
          {peutEcrireDevis && activeDevisStatut && ['SELECTIONNE', 'SIGNE_DIRECTION'].includes(activeDevisStatut) && (!factureAcompte || avoirSurAcompte) && (!factureSolde || avoirSurSolde) && (
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

  // Découpage par rôle (étape 3a) : tout non-hébergeur est servi par VueOrganisateur.
  // Placé APRÈS tous les hooks (règle React) — le rendu hébergeur ci-dessous est inchangé.
  if (user.role !== 'HEBERGEUR') {
    return (
      <VueOrganisateur
        sejour={sejour}
        user={user}
        budgetData={budgetData}
        onReload={onReload}
        onError={onError}
      />
    );
  }

  // Étape 4 (docs/CHANTIER_ETAPE4_CLIENT_HEBERGEUR.md) — bascule Lot 2 de ce lecteur, OPTION A :
  // résolution canonique du destinataire. Fallback createur.telephone/memberships différé (le prop
  // sejour.createur ne porte que {id,prenom,nom,email}) — complétion = Lot 2 complet, chantier séparé.
  const clientResolu = resolveClientEtablissement(sejour, { createur: sejour?.createur ?? null });

  return (
    <>
      {/* ── Vue hébergeur unifiée (DIRECT + collab/rejoint) — étape 3b ─── */}
      <div className="space-y-4">
          {devisLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
            </div>
          ) : devis ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Devis {devis.numeroDevis ?? ''}
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Créé le {new Date(devis.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                    {devis.statut === 'EN_ATTENTE' && devis.dateEnvoi && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Devis envoyé le {new Date(devis.dateEnvoi).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    etatFacturation === 'SOLDE' ? 'bg-teal-100 text-teal-700' :
                    etatFacturation === 'ACOMPTE' ? 'bg-indigo-100 text-indigo-700' :
                    devis.statut === 'EN_ATTENTE' ? 'bg-orange-100 text-orange-700' :
                    devis.statut === 'SELECTIONNE' ? 'bg-green-100 text-green-700' :
                    devis.statut === 'SIGNE_DIRECTION' ? 'bg-green-100 text-green-700' :
                    devis.statut === 'EN_ATTENTE_VALIDATION' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {etatFacturation === 'SOLDE' ? 'Soldé' :
                     etatFacturation === 'ACOMPTE' ? 'Acompte facturé' :
                     devis.statut === 'EN_ATTENTE' ? 'Brouillon' :
                     devis.statut === 'SELECTIONNE' ? 'Signé' :
                     devis.statut === 'SIGNE_DIRECTION' ? 'Signé' :
                     devis.statut === 'EN_ATTENTE_VALIDATION' ? 'En attente direction' :
                     devis.statut === 'NON_RETENU' ? 'Non retenu' :
                     devis.statut}
                  </span>
                </div>

                {(devis.lignes ?? []).length > 0 && (
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
                      {(devis.lignes ?? []).map((l, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2">{l.description}</td>
                          <td className="py-2 text-right">{l.quantite}</td>
                          <td className="py-2 text-right">{formatMontant(l.prixUnitaire + l.prixUnitaire * (l.tva / 100))} €</td>
                          <td className="py-2 text-right font-medium">{formatMontant(l.totalTTC)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  {devis.montantHT != null && (
                    <div className="flex justify-between"><span className="text-gray-500">HT</span><span>{formatMontant(Number(devis.montantHT))} €</span></div>
                  )}
                  {devis.montantTVA != null && (
                    <div className="flex justify-between"><span className="text-gray-500">TVA</span><span>{formatMontant(Number(devis.montantTVA))} €</span></div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Total TTC</span>
                    <span className="text-[var(--color-primary)]">{formatMontant(Number(devis.montantTTC ?? 0))} €</span>
                  </div>
                  {devis.montantAcompte != null && Number(devis.montantAcompte) > 0 && (
                    <div className="flex justify-between text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                      <span>Acompte ({devis.pourcentageAcompte ?? 30}%)</span>
                      <span className="font-semibold">{formatMontant(Number(devis.montantAcompte))} €</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {peutEcrireDevis && clientResolu.contactEmail && devis.statut === 'EN_ATTENTE' && (
                  <button
                    onClick={() => { setMessagePerso(''); setEnvoiError(null); setShowEnvoiModal(true); }}
                    disabled={envoyerLoading}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {envoyerLoading ? 'Envoi en cours…' : `📨 Envoyer à ${clientResolu.contactEmail}`}
                  </button>
                )}

                {peutEcrireDevis && !clientResolu.contactEmail && devis.statut === 'EN_ATTENTE' && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Renseignez l&apos;email du client pour pouvoir envoyer le devis par email.
                  </p>
                )}

                {envoyerSuccess && (
                  <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                    ✅ Devis envoyé par email ! Le client recevra un lien pour consulter et signer le devis.
                  </p>
                )}

                {showEnvoiModal && devis && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
                  >
                    <div
                      className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
                    >
                      <h2 className="text-base font-semibold text-gray-900">
                        Envoyer le devis à{' '}
                        {clientResolu.contactNom || 'votre client'}
                      </h2>
                      {clientResolu.contactEmail && (
                        <p className="text-xs text-gray-500 mt-0.5">{clientResolu.contactEmail}</p>
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

                      {envoisBloques && (
                        <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                          🕐 Votre centre est en cours de validation par l&apos;équipe LIAVO. En
                          attendant, vous ne pouvez envoyer un devis qu&apos;à votre propre adresse
                          email — testez le parcours en vous l&apos;envoyant à vous-même.
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
                              await renvoyerDevis(devis.id, messagePerso.trim() || undefined);
                              setShowEnvoiModal(false);
                              setEnvoyerSuccess(true);
                              await reloadDevis();
                            } catch (err) {
                              // extractApiError parse CENTRE_EN_VALIDATION|… et n'affiche
                              // que la partie lisible du message backend.
                              setEnvoiError(extractApiError(err));
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

                {peutEcrireDevis && ['EN_ATTENTE', 'EN_ATTENTE_VALIDATION', 'SELECTIONNE', 'SIGNE_DIRECTION'].includes(devis.statut) && !factureAcompte && (
                  <Link
                    href={`/dashboard/hebergeur/devis/${devis.id}/modifier`}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Modifier le devis
                  </Link>
                )}
                {peutEcrireDevis && (devis.statut === 'EN_ATTENTE' || devis.statut === 'SELECTIONNE')
                  && !devis.signatureDirecteur
                  && !devis.nomSignataireDirecteur && (
                  <MarquerSignePanel
                    devisId={devis.id}
                    buttonLabel={devis.statut === 'EN_ATTENTE' ? 'Enregistrer la signature du client' : 'Enregistrer la signature direction'}
                    onReload={reloadDevis}
                    onError={onError}
                  />
                )}
                {/* Ajuster les lignes avant le solde (acompte figé, solde sur total révisé) */}
                {peutEcrireDevis && factureAcompte && !factureSolde && (devis.statut === 'SELECTIONNE' || devis.statut === 'SIGNE_DIRECTION') && (
                  <Link
                    href={`/dashboard/hebergeur/devis/${devis.id}/modifier`}
                    className="rounded-lg border border-amber-300 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                  >
                    Ajuster avant solde
                  </Link>
                )}
              </div>

              {/* Bloc « Devis signé » — affiché dès lors que le devis est signé
                  (en ligne OU scan uploadé). Le scan ne renseigne pas le nom du
                  signataire : on retombe alors sur la date seule. */}
              {(devis.statut === 'SELECTIONNE' || devis.statut === 'SIGNE_DIRECTION')
                && (devis.nomSignataireDirecteur || devis.dateSignatureDirecteur) && (
                <BlocDevisSigne
                  nomSignataire={devis.nomSignataireDirecteur ?? null}
                  dateSignature={devis.dateSignatureDirecteur ?? null}
                  signatureDocumentUrl={devis.signatureDocumentUrl ?? null}
                />
              )}

              {/* Convention de séjour scolaire — DIRECT + nature SEJOUR + devis signé */}
              {sejour?.natureSejour === 'SEJOUR'
                && ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'].includes(devis.statut) && (
                <BlocConvention
                  devisId={devis.id}
                  conventionUrl={devis.conventionUrl ?? null}
                  contactEmail={clientResolu.contactEmail}
                  peutEcrireDevis={peutEcrireDevis}
                  onReload={reloadDevis}
                  onError={onError}
                />
              )}

              {/* Aperçu du contrat événement AVANT envoi (nature EVENEMENT) */}
              {sejour?.natureSejour === 'EVENEMENT' && (
                <BlocContratEvenement devisId={devis.id} onError={onError} />
              )}

              {/* Aperçu PDF du devis (signé ou non) — au-dessus de la section Facturation */}
              {(() => {
                const dd = devis!;
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
                  nomDestinataire: clientResolu.contactNom ?? '',
                  etablissementNom: clientResolu.nom ?? undefined,
                  adresseDestinataire: [clientResolu.adresse, [clientResolu.codePostal, clientResolu.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ') || undefined,
                  emailDestinataire: clientResolu.contactEmail ?? undefined,
                  telDestinataire: clientResolu.contactTelephone ?? undefined,
                  titreSejour: sejour?.titre ?? '',
                  lieuSejour: sejour?.lieu ?? '',
                  dateDebutSejour: sejour?.dateDebut ?? undefined,
                  dateFinSejour: sejour?.dateFin ?? undefined,
                  nombreEleves: sejour?.placesTotales ?? undefined,
                  nombreAccompagnateurs: sejour?.nombreAccompagnateurs ?? undefined,
                  niveauClasse: sejour?.niveauClasse ?? undefined,
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
                    <DevisPdfViewer documentUrl={dd.documentUrl ?? null} pdfProps={pdfPropsDirect} />
                  </div>
                );
              })()}

              {renderFacturationPipeline()}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Devis</h3>
              <p className="text-xs text-gray-500 mb-4">Créez un devis pour ce séjour et envoyez-le au client pour signature.</p>
              {peutEcrireDevis && (
                <Link
                  href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${sejourId}`}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  Créer un devis
                </Link>
              )}
            </div>
          )}
          {renderDevisComplementaires()}
      </div>

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
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
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
                  {avoirLignes.map((l, i) => {
                    const sousTotal = l.quantiteMax > 0
                      ? round2(l.totalTTCorig * l.quantiteAnnulee / l.quantiteMax)
                      : 0;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
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
                        <input
                          type="number"
                          min={0}
                          max={l.quantiteMax}
                          step="any"
                          value={l.quantiteAnnulee}
                          disabled={!l.selected || l.quantiteMax === 0}
                          onChange={(e) => updateQuantiteAvoir(i, parseFloat(e.target.value))}
                          className="w-14 rounded border border-gray-300 px-1.5 py-1 text-right text-xs disabled:opacity-40 disabled:bg-gray-100"
                        />
                        <span className="text-gray-400 whitespace-nowrap">/ {l.quantiteMax}</span>
                        <span className="font-semibold text-red-600 min-w-[70px] text-right">
                          −{formatMontant(sousTotal)} €
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Récapitulatif montant */}
            <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <span className="text-sm font-medium text-red-700">Montant de l'avoir</span>
              <span className="text-lg font-bold text-red-700">
                −{formatMontant(avoirMontant)} €
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">{editingComplementaireId ? 'Modifier le devis complémentaire' : 'Nouveau devis complémentaire'}</h2>
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
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1 font-medium">Description</th>
                    <th className="py-1 font-medium w-16 text-right">Qté</th>
                    <th className="py-1 font-medium w-24 text-right">PU TTC</th>
                    <th className="py-1 font-medium w-16 text-right">TVA %</th>
                    <th className="py-1 font-medium w-24 text-right">Total TTC</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {calcCompTotaux().map((l, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-2">
                        <CatalogueSuggestionInput
                          value={compForm.lignes[i].description}
                          onChange={v => updateCompLigne(i, 'description', v)}
                          catalogue={catalogue}
                          onSelect={p => selectCompProduit(i, p)}
                          placeholder="ex: Activités ski"
                          className="w-full rounded border border-gray-300 px-2 py-1"
                        />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} value={compForm.lignes[i].quantite} onChange={e => updateCompLigne(i, 'quantite', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} step="0.01" value={compForm.lignes[i].prixUnitaire} onChange={e => updateCompLigne(i, 'prixUnitaire', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                      </td>
                      <td className="py-1">
                        <input type="number" min={0} step="0.1" value={compForm.lignes[i].tva} onChange={e => updateCompLigne(i, 'tva', e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-right" />
                      </td>
                      <td className="py-1 text-right font-medium">{formatMontant(l.totalTTC)} €</td>
                      <td className="py-1 text-center">
                        {compForm.lignes.length > 1 && (
                          <button onClick={() => removeCompLigne(i)} className="text-red-400 hover:text-red-600" title="Supprimer">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={addCompLigne}
                className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ajouter une ligne
              </button>

              <div className="mt-3 flex justify-end">
                <div className="text-sm font-bold">
                  Total TTC : <span className="text-[var(--color-primary)]">{formatMontant(compTotalTTC)} €</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleCreerComplementaire} disabled={compLoading}
                className="flex-1 rounded-lg bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {compLoading
                  ? (editingComplementaireId ? 'Enregistrement…' : 'Création…')
                  : (editingComplementaireId ? 'Enregistrer les modifications' : 'Créer le devis complémentaire')}
              </button>
              <button onClick={() => setShowModalComplementaire(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale envoi facture par email ────────────────────── */}
      {showEnvoiFactureModal && envoiFactureTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Envoyer {envoiFactureTarget.typeFacture === 'ACOMPTE' ? "la facture d'acompte" : envoiFactureTarget.typeFacture === 'AVOIR' ? "l'avoir" : 'la facture de solde'} par email
            </h3>

            {envoiFactureSuccess ? (
              <div className="flex items-center gap-2 text-green-600 py-8 justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="font-medium">Facture envoyée à {envoiFactureEmail}</span>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destinataire</label>
                    <input
                      type="email"
                      value={envoiFactureEmail}
                      onChange={(e) => setEnvoiFactureEmail(e.target.value)}
                      placeholder="Ex : comptabilite@ecole.fr"
                      className={inputCls}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea
                      value={envoiFactureMessage}
                      onChange={(e) => setEnvoiFactureMessage(e.target.value)}
                      rows={6}
                      className={inputCls}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    La facture {envoiFactureTarget.numero} sera envoyée en pièce jointe (PDF).
                    {envoiFactureTarget.typeFacture !== 'AVOIR' && (
                      <> Montant : {envoiFactureTarget.montantFacture.toFixed(2).replace('.', ',')} €</>
                    )}
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowEnvoiFactureModal(false)}
                    disabled={envoiFactureLoading}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEnvoiFacture}
                    disabled={envoiFactureLoading || !envoiFactureEmail.trim()}
                    className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
                  >
                    {envoiFactureLoading ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
