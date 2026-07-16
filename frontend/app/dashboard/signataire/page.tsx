'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAllSejours, getSejourDetail, soumettreAuRectorat, getDossierPedagogique, estHorsScolaire } from '@/src/lib/sejour';
import type { DossierPedagogiqueData } from '@/src/lib/sejour';
import api from '@/src/lib/api';
import {
  getDevisAValider,
  updateDevisStatut,
  signerDevis,
  getFacturesAcompte,
  validerAcompte,
  getChorusXml,
} from '@/src/lib/devis';
import type { SejourDirecteur, StatutSejour, SejourDetail } from '@/src/lib/sejour';
import type { Devis, LigneDevis, Facture } from '@/src/lib/devis';

// Facture d'acompte renvoyée par /devis/factures-acompte (devis + centre + séjour imbriqués).
type FactureAcompte = Facture & {
  devis?: {
    id: string;
    centre?: { id: string; nom: string; ville: string } | null;
    demande?: {
      sejour?: { id: string; titre: string; dateDebut: string; dateFin: string } | null;
    } | null;
  } | null;
};
import { getBudgetData } from '@/src/lib/collaboration';
import type { BudgetData } from '@/src/lib/collaboration';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import { formatDate } from '@/src/lib/utils';

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutSejour, { label: string; cls: string }> = {
  DRAFT:      { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  OPTION:     { label: 'Option',     cls: 'bg-amber-100 text-amber-700' },
  SUBMITTED:  { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  CONVENTION:      { label: 'Convention',       cls: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' },
  SOUMIS_RECTORAT: { label: 'Soumis rectorat', cls: 'bg-purple-100 text-purple-700' },
  SIGNE_DIRECTION: { label: 'Signé direction', cls: 'bg-purple-100 text-purple-700' },
  DECLARE_TAM:     { label: 'Déclaré TAM',     cls: 'bg-teal-100 text-teal-700' },
};

function StatutBadge({ statut }: { statut: StatutSejour }) {
  const { label, cls } = STATUT_CONFIG[statut] ?? STATUT_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Modale Chorus Pro ──────────────────────────────────────────────────────

function ChorusModal({ xml, onClose }: { xml: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(xml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Aperçu Chorus Pro — Format PEPPOL UBL 2.1</h2>
            <p className="text-xs text-gray-500 mt-0.5">En production, ce fichier sera transmis automatiquement à chorus-pro.gouv.fr</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-light)] px-3 py-1 text-xs font-semibold text-[var(--color-success)]">Prêt pour Chorus Pro</span>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          <pre className="text-xs leading-relaxed text-gray-800 bg-gray-50 rounded-lg border border-gray-200 p-4 overflow-x-auto whitespace-pre-wrap break-all font-mono">{xml}</pre>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            {copied ? 'Copié !' : 'Copier le XML'}
          </button>
          <button onClick={onClose} className="inline-flex items-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Label ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider mb-2 mt-5 first:mt-0 flex items-center gap-2">
      <span className="h-px flex-1 bg-[var(--color-primary-light)]" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-[var(--color-primary-light)]" />
    </h3>
  );
}

// ─── Carte Séjour (nouvelle version unifiée) ────────────────────────────────

function SejourCard({
  sejour,
  onSign,
  onRefuse,
  onSoumettreRectorat,
  onValiderAcompte,
  isActing,
  emailRectoratConfigured,
}: {
  sejour: any;
  onSign: (devisId: string) => void;
  onRefuse: (devisId: string) => void;
  onSoumettreRectorat: (sejourId: string) => void;
  onValiderAcompte: (devisId: string) => void;
  isActing: boolean;
  emailRectoratConfigured: boolean;
}) {
  const fmt = (n: number) => n.toLocaleString('fr-FR',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const devisActif = sejour.demandes?.[0]?.devis?.[0] ?? null;
  const hasDevisASign = devisActif &&
    (devisActif.statut === 'EN_ATTENTE_VALIDATION' ||
     devisActif.statut === 'SELECTIONNE') &&
    !devisActif.signatureDirecteur;
  const hasDevisSigne = devisActif?.signatureDirecteur;

  const factureAcompte = sejour.demandes?.[0]?.devis?.find(
    (d: any) => d.typeDocument === 'FACTURE_ACOMPTE' && !d.acompteVerse
  ) ?? null;

  const buildPdfProps = (dv: any): DevisPDFProps => {
    const ens = dv.demande?.enseignant;
    const sej = dv.demande?.sejour;
    const htCalc = Number(dv.montantHT) ||
      (dv.lignes ?? []).reduce((sum: number, l: any) => sum + Number(l.totalHT), 0);
    const ttcCalc = Number(dv.montantTTC) || Number(dv.montantTotal) || 0;
    const tvaCalc = Number(dv.montantTVA) || (ttcCalc - htCalc);
    return {
      typeDocument: 'DEVIS',
      numeroDocument: dv.numeroDevis ?? `DEV-${dv.id.substring(0, 8).toUpperCase()}`,
      dateDocument: dv.createdAt,
      dateValidite: new Date(new Date(dv.createdAt).getTime() + 30 * 86400000).toISOString(),
      nomEmetteur: dv.nomEntreprise ?? dv.centre?.nom ?? '',
      adresseEmetteur: dv.adresseEntreprise ?? [dv.centre?.adresse, dv.centre?.codePostal, dv.centre?.ville].filter(Boolean).join(', '),
      siretEmetteur: dv.siretEntreprise ?? dv.centre?.siret ?? undefined,
      emailEmetteur: dv.emailEntreprise ?? dv.centre?.email ?? undefined,
      telEmetteur: dv.telEntreprise ?? dv.centre?.telephone ?? undefined,
      nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
      etablissementNom: ens?.memberships?.[0]?.organisation.nom ?? undefined,
      adresseDestinataire: ens?.memberships?.[0]?.organisation.ville ?? undefined,
      emailDestinataire: ens?.email ?? undefined,
      telDestinataire: ens?.telephone ?? undefined,
      titreSejour: sej?.titre ?? dv.demande?.titre ?? '',
      lieuSejour: dv.demande?.villeHebergement,
      dateDebutSejour: sej?.dateDebut ?? undefined,
      dateFinSejour: sej?.dateFin ?? undefined,
      nombreEleves: dv.demande?.nombreEleves,
      niveauClasse: sej?.niveauClasse ?? undefined,
      lignes: (dv.lignes ?? []).map((l: any) => ({
        description: l.description, quantite: l.quantite, prixUnitaire: l.prixUnitaire,
        tva: l.tva, totalHT: l.totalHT, totalTTC: l.totalTTC,
      })),
      montantHT: htCalc, montantTVA: tvaCalc, montantTTC: ttcCalc,
      montantAcompte: dv.montantAcompte != null ? Number(dv.montantAcompte) : undefined,
      montantSolde: dv.montantSolde != null ? Number(dv.montantSolde) : undefined,
      pourcentageAcompte: dv.pourcentageAcompte ?? undefined,
      conditionsAnnulation: dv.conditionsAnnulation ?? dv.centre?.conditionsAnnulation ?? undefined,
      signatureDirecteur: dv.signatureDirecteur ?? undefined,
      logoUrl: dv.centre?.logoUrl ?? null,
    };
  };

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
      hasDevisASign ? 'border-amber-300' : 'border-gray-200'
    }`}>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-gray-900">{sejour.titre}</h3>
              <StatutBadge statut={sejour.statut} />
              {hasDevisASign && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Devis à signer
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {sejour.createur && <span>{sejour.createur.prenom} {sejour.createur.nom}</span>}
              {sejour.createur?.memberships?.[0]?.organisation?.nom && (
                <span>{sejour.createur.memberships[0].organisation.nom}</span>
              )}
              <span>{formatDate(sejour.dateDebut, 'court')} → {formatDate(sejour.dateFin, 'court')}</span>
              <span>{sejour.placesTotales} {estHorsScolaire(sejour) ? 'participant' : 'élève'}{sejour.placesTotales > 1 ? 's' : ''}</span>
              {sejour.hebergementSelectionne && <span>Hébergeur : {sejour.hebergementSelectionne.nom}</span>}
            </div>
          </div>
          <a
            href={`/dashboard/sejour/${sejour.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Espace collaboratif
          </a>
        </div>
      </div>

      {hasDevisASign && devisActif && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Devis en attente de signature</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-800 space-y-0.5">
              <p className="font-medium">{devisActif.centre?.nom ?? '—'} — {devisActif.centre?.ville ?? '—'}</p>
              <p>Total TTC : <span className="font-bold">{fmt(Number(devisActif.montantTTC ?? devisActif.montantTotal))} €</span> · Par élève : {devisActif.montantParEleve} €</p>
              {devisActif.lignes?.length > 0 && (
                <p>{devisActif.lignes.length} ligne{devisActif.lignes.length > 1 ? 's' : ''} de prestation</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <DevisPDFButton
                data={buildPdfProps(devisActif)}
                filename={`devis-${(devisActif.numeroDevis ?? devisActif.id).substring(0, 8)}.pdf`}
                label="Voir le devis"
              />
              <button type="button" onClick={() => onRefuse(devisActif.id)} disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors">
                Refuser
              </button>
              <button type="button" onClick={() => onSign(devisActif.id)} disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors">
                {isActing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
                Signer électroniquement
              </button>
            </div>
          </div>
        </div>
      )}

      {hasDevisSigne && (sejour.statut === 'SIGNE_DIRECTION' || sejour.statut === 'CONVENTION') && !estHorsScolaire(sejour) && (
        <div className="border-t border-purple-100 bg-purple-50 px-5 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-purple-700">
              Devis signé par {devisActif.nomSignataireDirecteur ?? 'la direction'}
              {devisActif.dateSignatureDirecteur && (
                <span> le {new Date(devisActif.dateSignatureDirecteur).toLocaleDateString('fr-FR')}</span>
              )}
            </p>
            {emailRectoratConfigured ? (
              <button type="button" onClick={() => onSoumettreRectorat(sejour.id)} disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors">
                Soumettre au rectorat
              </button>
            ) : (
              <span className="text-xs text-amber-600">Configurez l&apos;email de notification pour soumettre le dossier</span>
            )}
          </div>
        </div>
      )}

      {hasDevisSigne && (sejour.statut === 'SIGNE_DIRECTION' || sejour.statut === 'CONVENTION') && estHorsScolaire(sejour) && (
        <div className="border-t border-teal-100 bg-teal-50 px-5 py-3">
          <p className="text-xs text-teal-700">
            Séjour hors scolaire — aucune soumission au rectorat requise. Le dossier de déclaration TAM est disponible dans l&apos;espace collaboratif.
          </p>
        </div>
      )}

      {factureAcompte && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs text-amber-800">
              <span className="font-semibold">Facture acompte {factureAcompte.numeroFacture}</span>
              <span className="ml-2">{fmt(Number(factureAcompte.montantAcompte ?? 0))} €</span>
            </div>
            <button type="button" onClick={() => onValiderAcompte(factureAcompte.id)} disabled={isActing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors">
              Valider le paiement acompte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function SignataireDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [sejours, setSejours]     = useState<SejourDirecteur[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actingId, setActingId]   = useState<string | null>(null);
  const [filtre, setFiltre]       = useState<StatutSejour | 'ALL'>('ALL');
  const [devisAValider, setDevisAValider] = useState<Devis[]>([]);
  const [devisActingId, setDevisActingId] = useState<string | null>(null);

  // Factures (Lot 1 : entité Facture immuable, type ACOMPTE non validée)
  const [factures, setFactures] = useState<FactureAcompte[]>([]);
  const [factureActingId, setFactureActingId] = useState<string | null>(null);
  const [chorusXml, setChorusXml] = useState<string | null>(null);

  // Modales
  const [sejourDetail, setSejourDetail] = useState<SejourDetail | null>(null);
  const [sejourDetailLoading, setSejourDetailLoading] = useState(false);
  const [devisDetail, setDevisDetail] = useState<Devis | null>(null);

  // Paramètres directeur
  const [emailRectorat, setEmailRectorat] = useState('');
  const [emailRectoratSaved, setEmailRectoratSaved] = useState('');
  const [emailRectoratSaving, setEmailRectoratSaving] = useState(false);
  const [emailRectoratMsg, setEmailRectoratMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const loadSejours = useCallback(async () => {
    try {
      const data = await getAllSejours();
      setSejours(data);
    } catch {
      setLoadError('Impossible de charger les séjours.');
    }
  }, []);

  const loadDevis = useCallback(async () => {
    try {
      setDevisAValider(await getDevisAValider());
    } catch { /* ignore */ }
  }, []);

  const loadFactures = useCallback(async () => {
    try {
      setFactures(await getFacturesAcompte());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (user) {
      loadSejours();
      loadDevis();
      loadFactures();
      api.get('/users/me').then(({ data }) => {
        setEmailRectorat(data.emailRectorat ?? '');
        setEmailRectoratSaved(data.emailRectorat ?? '');
      }).catch(() => {});
    }
  }, [user, loadSejours, loadDevis, loadFactures]);

  const handleOpenSejourDetail = async (id: string) => {
    setSejourDetailLoading(true);
    try {
      const detail = await getSejourDetail(id);
      setSejourDetail(detail);
    } catch {
      // fallback: ignore
    } finally {
      setSejourDetailLoading(false);
    }
  };

  const [rectoratSuccess, setRectoratSuccess] = useState<string | null>(null);

  const handleSaveEmailRectorat = async () => {
    setEmailRectoratSaving(true);
    try {
      await api.patch('/users/mon-profil', { emailRectorat: emailRectorat.trim() || undefined });
      setEmailRectoratSaved(emailRectorat.trim());
      setEmailRectoratMsg('Email DSDEN enregistré');
      setTimeout(() => setEmailRectoratMsg(null), 3000);
    } catch {
      setEmailRectoratMsg('Erreur lors de l\'enregistrement');
      setTimeout(() => setEmailRectoratMsg(null), 3000);
    } finally {
      setEmailRectoratSaving(false);
    }
  };

  const handleSoumettreRectorat = async (id: string) => {
    setActingId(id);
    try {
      await soumettreAuRectorat(id);
      setSejours(prev => prev.map(s => s.id === id ? { ...s, statut: 'SOUMIS_RECTORAT' as StatutSejour } : s));
      if (sejourDetail?.id === id) {
        setSejourDetail({ ...sejourDetail, statut: 'SOUMIS_RECTORAT' as StatutSejour });
      }
      setRectoratSuccess('Dossier soumis — email envoyé');
      setTimeout(() => setRectoratSuccess(null), 4000);
    } catch (err) {
      console.error('[handleSoumettreRectorat]', err);
      setLoadError('Une erreur est survenue. Veuillez réessayer.');
      loadSejours().catch(() => {});
    } finally {
      setActingId(null);
    }
  };

  const handleDevisAction = async (devisId: string, statut: 'SELECTIONNE' | 'NON_RETENU') => {
    setDevisActingId(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      await Promise.all([loadDevis(), loadSejours(), loadFactures()]);
      setDevisDetail(null);
    } catch (err) {
      console.error('[handleDevisAction]', err);
      setLoadError('Une erreur est survenue. Veuillez réessayer.');
      await Promise.all([loadDevis(), loadSejours(), loadFactures()]).catch(() => {});
    }
    setDevisActingId(null);
  };

  const handleSignerDevis = async (devisId: string) => {
    setDevisActingId(devisId);
    try {
      await signerDevis(devisId);
      await Promise.all([loadDevis(), loadSejours()]);
      setDevisDetail(null);
    } catch (err) {
      console.error('[handleSignerDevis]', err);
      setLoadError('Une erreur est survenue. Veuillez réessayer.');
      await Promise.all([loadDevis(), loadSejours()]).catch(() => {});
    }
    setDevisActingId(null);
  };

  // Lot 1 : validation ciblée par factureId → PATCH /factures/:id/valider-acompte
  const handleValiderAcompte = async (factureId: string) => {
    setFactureActingId(factureId);
    try {
      await validerAcompte(factureId);
      await loadFactures();
    } catch (err) {
      console.error('[handleValiderAcompte]', err);
      setLoadError('Une erreur est survenue. Veuillez réessayer.');
      await loadFactures().catch(() => {});
    }
    setFactureActingId(null);
  };

  // Lot 1 : XML Chorus Pro ciblé par factureId → GET /factures/:id/chorus-xml
  const handleChorusXml = async (factureId: string) => {
    try {
      const { xml } = await getChorusXml(factureId);
      setChorusXml(xml);
    } catch { /* ignore */ }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const sejoursFiltres = filtre === 'ALL'
    ? sejours
    : filtre === ('ASIGNER' as any)
      ? sejours.filter((s: any) => s.demandes?.[0]?.devis?.[0] && !s.demandes[0].devis[0].signatureDirecteur)
      : sejours.filter((s) => s.statut === filtre);

  const countByStatut = (s: StatutSejour) => sejours.filter((x) => x.statut === s).length;

  const facturesNonPayees = factures.filter((f) => !f.acompteVerse);
  const facturesPayees = factures.filter((f) => f.acompteVerse);

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>

      {/* Modals */}
      {rectoratSuccess && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-purple-600 text-white px-5 py-3 text-sm font-semibold shadow-lg animate-in fade-in">
          {rectoratSuccess}
        </div>
      )}
      {chorusXml && <ChorusModal xml={chorusXml} onClose={() => setChorusXml(null)} />}

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Validation des séjours</h1>
          <p className="mt-1 text-sm text-gray-500">Approuvez ou refusez les séjours soumis par les enseignants</p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['ALL',              'Tous',            sejours.length,                      'bg-gray-100 text-gray-700 ring-gray-300'],
            ['ASIGNER',         'À signer',        sejours.filter(s => s.demandes?.[0]?.devis?.[0] && !s.demandes[0].devis[0].signatureDirecteur).length, 'bg-amber-50 text-amber-700 ring-amber-300'],
            ['SIGNE_DIRECTION',  'Signé direction', countByStatut('SIGNE_DIRECTION'),    'bg-purple-50 text-purple-700 ring-purple-300'],
            ['SOUMIS_RECTORAT',  'Soumis',          countByStatut('SOUMIS_RECTORAT'),    'bg-purple-50 text-purple-700 ring-purple-300'],
          ] as const).map(([val, label, count, cls]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFiltre(val as any)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all ${cls} ${
                filtre === val ? 'ring-2 shadow-sm' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {label}
              <span className="rounded-full bg-white/60 px-1.5 py-0.5 font-semibold">{count}</span>
            </button>
          ))}
        </div>

        {/* Erreur */}
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Liste séjours */}
        {sejoursFiltres.length > 0 ? (
          <div className="space-y-3">
            {sejoursFiltres.map((s: any) => (
              <SejourCard
                key={s.id}
                sejour={s}
                onSign={handleSignerDevis}
                onRefuse={(devisId: string) => handleDevisAction(devisId, 'NON_RETENU')}
                onSoumettreRectorat={handleSoumettreRectorat}
                onValiderAcompte={handleValiderAcompte}
                isActing={!!(devisActingId || actingId)}
                emailRectoratConfigured={!!emailRectoratSaved}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <h2 className="text-base font-semibold text-gray-900">Aucun séjour à afficher</h2>
            <p className="mt-1 text-sm text-gray-500">Aucun séjour dans cette catégorie.</p>
          </div>
        )}

        {/* ── Factures d'acompte à valider ──────────────────────────── */}
        {facturesNonPayees.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Factures d&apos;acompte à valider
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                {facturesNonPayees.length}
              </span>
            </h2>
            <div className="space-y-3">
              {facturesNonPayees.map((f) => (
                <div key={f.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {f.devis?.demande?.sejour?.titre ?? 'Séjour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {f.numero}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Hébergeur : {f.devis?.centre?.nom ?? '—'}</span>
                        <span>
                          Montant acompte :{' '}
                          <span className="font-bold text-amber-700">{fmt(f.montantFacture)} €</span>
                        </span>
                        <span>Total TTC : {fmt(f.montantTTC)} €</span>
                        {f.dateEmission && (
                          <span>Date : {new Date(f.dateEmission).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleValiderAcompte(f.id)}
                        disabled={factureActingId === f.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {factureActingId === f.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : null}
                        Valider le paiement acompte
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChorusXml(f.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                      >
                        Envoyer à Chorus Pro
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Factures payées ───────────────────────────────────────── */}
        {facturesPayees.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Acomptes validés
              <span className="ml-2 inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
                {facturesPayees.length}
              </span>
            </h2>
            <div className="space-y-3">
              {facturesPayees.map((f) => (
                <div key={f.id} className="bg-white rounded-xl border border-[var(--color-success)]/20 shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {f.devis?.demande?.sejour?.titre ?? 'Séjour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          Acompte versé — {f.numero}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Hébergeur : {f.devis?.centre?.nom ?? '—'}</span>
                        <span>Montant : {fmt(f.montantFacture)} €</span>
                        {f.dateVersement && (
                          <span>Versé le : {new Date(f.dateVersement).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleChorusXml(f.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                      >
                        Envoyer à Chorus Pro
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── Paramètres ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mt-8">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Paramètres
            {emailRectoratSaved ? (
              <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Configuré</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">À configurer</span>
            )}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email de notification (DSDEN ou responsable hiérarchique)</label>
              <p className="text-xs text-gray-500 mb-2">Cet email sera utilisé automatiquement pour envoyer le dossier lors de la soumission</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailRectorat}
                  onChange={(e) => setEmailRectorat(e.target.value)}
                  placeholder="dsden@ac-academie.fr ou directeur@structure.fr"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <button
                  type="button"
                  onClick={handleSaveEmailRectorat}
                  disabled={emailRectoratSaving}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {emailRectoratSaving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block" />
                  ) : 'Enregistrer'}
                </button>
              </div>
              {emailRectoratMsg && (
                <p className="mt-2 text-xs text-[var(--color-success)] font-medium">{emailRectoratMsg}</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
