'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { getMonProfil, getMesCentres, uploadCentreImage } from '@/src/lib/centre';
import type { Centre } from '@/src/lib/centre';
import { getMesDevis, getFactureAcompte, getFactureSolde } from '@/src/lib/devis';
import type { Devis } from '@/src/lib/devis';
import { getMesSejoursConvention } from '@/src/lib/collaboration';
import { getDemandesOuvertes } from '@/src/lib/demande';
import { getRappelsToday } from '@/src/lib/clients';
import type { RappelToday } from '@/src/lib/clients';
import { getTableauRentabilite } from '@/src/lib/rentabilite';
import { getAbonnementStatut } from '@/src/lib/abonnement';
import type { TableauRentabilite } from '@/src/lib/rentabilite';

// ─── CA confirmé : helpers réutilisables (futur : page /ca avec graphique annuel) ───
type PeriodeCA = 'DDA' | 'DDM' | 'T1' | 'T2' | 'T3' | 'T4';

const STATUTS_CA = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];

/** Date de début du séjour d'un devis (collab → demande.sejour, direct → sejourDirect, fallback createdAt). */
function resolveSejourDateDebut(d: Devis): string {
  return d.demande?.sejour?.dateDebut ?? d.sejourDirect?.dateDebut ?? d.createdAt;
}

/** Id du séjour d'un devis (pour compter les séjours distincts). */
function resolveSejourId(d: Devis): string | null {
  return d.demande?.sejour?.id ?? d.sejourDirect?.id ?? null;
}

/** Bornes [start, end] d'une période CA pour l'année en cours. */
function getPeriodeBounds(periode: PeriodeCA): { start: Date; end: Date } {
  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  switch (periode) {
    case 'DDA': return { start: new Date(year, 0, 1), end: endOfYear };
    case 'DDM': return { start: new Date(year, month, 1), end: endOfYear };
    case 'T1':  return { start: new Date(year, 0, 1),  end: new Date(year, 2, 31, 23, 59, 59) };
    case 'T2':  return { start: new Date(year, 3, 1),  end: new Date(year, 5, 30, 23, 59, 59) };
    case 'T3':  return { start: new Date(year, 6, 1),  end: new Date(year, 8, 30, 23, 59, 59) };
    case 'T4':  return { start: new Date(year, 9, 1),  end: endOfYear };
  }
}

/** CA TTC confirmé (devis signés, hors complémentaires) filtré par date de séjour ∈ [start, end]. */
function computeCAConfirme(devis: Devis[], start: Date, end: Date): { montant: number; nbSejours: number } {
  const sejourIds = new Set<string>();
  let montant = 0;
  for (const d of devis) {
    if (d.isComplementaire) continue;
    if (!STATUTS_CA.includes(d.statut)) continue;
    const dd = new Date(resolveSejourDateDebut(d));
    if (dd < start || dd > end) continue;
    montant += d.montantTTC ?? Number(d.montantTotal) ?? 0;
    const sid = resolveSejourId(d);
    if (sid) sejourIds.add(sid);
  }
  return { montant, nbSejours: sejourIds.size };
}

export default function HebergeurDashboard() {
  const { user, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [centre, setCentre] = useState<any>(null);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [periodeCA, setPeriodeCA] = useState<PeriodeCA>('DDA');
  const [sejoursConvention, setSejoursConvention] = useState<any[]>([]);
  const [demandes, setDemandes] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rappelsAujourdhui, setRappelsAujourdhui] = useState<RappelToday[]>([]);
  const [claimStatut, setClaimStatut] = useState<string | null>(null);
  const [claimOrgNom, setClaimOrgNom] = useState<string | null>(null);
  const [centresPending, setCentresPending] = useState<{ id: string; nom: string; claimDocumentUrl: string | null }[]>([]);
  const [essaiActif, setEssaiActif] = useState(false);
  const [essaiExpire, setEssaiExpire] = useState(false);
  const [joursRestants, setJoursRestants] = useState(0);
  const [rentabilite, setRentabilite] = useState<TableauRentabilite | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profil, mesDevis, sejours, mesDemandes, rappels] = await Promise.all([
        // getMonProfil() porte @RequirePermission('parametres') : rejeté pour un
        // collaborateur sans ce droit → fallback CentreResume (dashboard de base).
        // Cast en Centre (sous-type structurel) : les champs absents (telephone,
        // abonnementActifJusquAu) sont undefined au runtime et lus en optional-chaining.
        getMonProfil().catch(async () => ((await getMesCentres())[0] ?? null) as Centre | null),
        getMesDevis(),
        getMesSejoursConvention(),
        getDemandesOuvertes().catch(() => []),
        getRappelsToday().catch(() => []),
      ]);
      setCentre(profil);
      setDevis(mesDevis);
      setSejoursConvention(sejours);
      setDemandes(mesDemandes);
      setRappelsAujourdhui(rappels);

      const aboStatut = await getAbonnementStatut().catch(() => null);
      if (aboStatut) {
        setEssaiActif(aboStatut.isTrial);
        setEssaiExpire(aboStatut.trialExpire);
        setJoursRestants(aboStatut.joursRestants);
      }
    } catch {}
    const claimData = await api
      .get('/organisations/mon-claim-statut')
      .then((r) => r.data ?? null)
      .catch(() => null);
    setClaimStatut(claimData?.claimStatut ?? null);
    setClaimOrgNom(claimData?.organisationNom ?? null);
    const pend = await api
      .get('/centres/mes-centres-pending')
      .then((r) => r.data ?? [])
      .catch(() => []);
    setCentresPending(pend);
  }, []);

  const handleUploadJustif = async (centreId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('document', file);
    try {
      await api.post(`/centres/${centreId}/upload-justificatif`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadData();
    } catch {
      alert('Erreur lors de l\'envoi du justificatif. Réessayez.');
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') loadData();
  }, [user, loadData]);

  // Carte rentabilité — chargement indépendant (fire-and-forget, hors loadData)
  useEffect(() => {
    getTableauRentabilite({ annee: new Date().getFullYear().toString() })
      .then((r) => setRentabilite(r))
      .catch(() => {});
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      alert('Format non supporté. Utilisez JPG, PNG ou WebP.');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Fichier trop lourd. Maximum 10 Mo.');
      e.target.value = '';
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadCentreImage(file);
      setCentre((prev: any) => ({ ...prev, imageUrl: updated.imageUrl }));
    } catch {
      alert("Erreur lors de l'upload. Réessayez.");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading || !user) return null;

  // Métriques
  const demandesNonLues = demandes.length;
  const abonnementActif = centre?.abonnementStatut === 'ACTIF';
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const annee = new Date().getFullYear();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // ── KPI 1 — CA confirmé (filtré par période sélectionnée) ──
  const caBounds = getPeriodeBounds(periodeCA);
  const ca = computeCAConfirme(devis, caBounds.start, caBounds.end);
  const caPeriodeLabel = (periodeCA === 'DDA' || periodeCA === 'DDM')
    ? `Depuis le ${caBounds.start.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${periodeCA} ${annee}`;

  // ── KPI 2 — Devis en attente ──
  const devisAttente = devis.filter(d =>
    d.isComplementaire !== true && (d.statut === 'EN_ATTENTE' || d.statut === 'EN_ATTENTE_VALIDATION'),
  );
  const kpiAttenteCount = devisAttente.length;
  const kpiAttenteMontant = devisAttente.reduce((s, d) => s + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0);

  // ── KPI 3 — À facturer (acompte non émis + solde non émis sur séjour passé) ──
  // Aligné sur l'onglet "Sélectionnés" (pas encore facturé : ni acompte ni solde).
  const aFacturerAcompte = devis.filter(d =>
    d.isComplementaire !== true &&
    (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION') &&
    getFactureAcompte(d) === null && getFactureSolde(d) === null,
  );
  const aFacturerSolde = devis.filter(d =>
    d.isComplementaire !== true &&
    getFactureAcompte(d) !== null && getFactureSolde(d) === null &&
    new Date(resolveSejourDateDebut(d)) < today,
  );
  const kpiAFacturerCount = aFacturerAcompte.length + aFacturerSolde.length;
  const kpiAFacturerMontant =
    aFacturerAcompte.reduce((s, d) => {
      const ttc = d.montantTTC ?? Number(d.montantTotal) ?? 0;
      return s + (d.montantAcompte ?? (ttc * (d.pourcentageAcompte ?? 30) / 100));
    }, 0) +
    aFacturerSolde.reduce((s, d) => {
      const ttc = d.montantTTC ?? Number(d.montantTotal) ?? 0;
      const fa = getFactureAcompte(d);
      return s + (ttc - (fa ? fa.montantFacture : 0));
    }, 0);

  // ── KPI 4 — Impayés (factures émises non intégralement réglées) ──
  let kpiImpayesCount = 0;
  let kpiImpayesMontant = 0;
  for (const d of devis) {
    for (const f of d.factures ?? []) {
      if (f.typeFacture === 'AVOIR') continue;
      // Un acompte validé n'est jamais un impayé (micro-écart d'arrondi/frais ignoré).
      if (f.typeFacture === 'ACOMPTE' && f.acompteVerse) continue;
      const verse = f.montantVerseTotal ?? 0;
      if (verse < f.montantFacture) {
        kpiImpayesCount++;
        kpiImpayesMontant += f.montantFacture - verse;
      }
    }
  }

  // Badge "Devis & Facturation" (Actions prioritaires) : actions hébergeur à traiter.
  const actionsFacturationUrgentes = kpiAFacturerCount + kpiImpayesCount;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-bg)]">

      {claimStatut === 'EN_ATTENTE_DOCUMENT' && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <p className="text-sm text-amber-800">
            <strong>Revendication en cours{claimOrgNom ? ` — ${claimOrgNom}` : ''}</strong> — Votre Kbis est attendu pour valider
            la propriété de votre centre. <a href="/dashboard/hebergeur/documents"
            className="underline font-medium">Déposer le document →</a>
          </p>
        </div>
      )}
      {claimStatut === 'EN_ATTENTE_VALIDATION' && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <p className="text-sm text-blue-800">
            <strong>Validation en cours</strong> — Votre demande de revendication
            {claimOrgNom ? ` pour ${claimOrgNom}` : ''} est en cours de validation.
            Vous recevrez un email dès qu&apos;elle sera traitée.
          </p>
        </div>
      )}

      {centresPending.map((c) => (
        <div key={c.id} className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <p className="text-sm text-amber-800">
            <strong>Demande pour {c.nom} en attente de validation</strong> — notre équipe examine votre demande.
            {!c.claimDocumentUrl && (
              <>
                {' '}
                <label className="underline font-medium cursor-pointer">
                  + Ajouter un justificatif
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => handleUploadJustif(c.id, e)}
                  />
                </label>
              </>
            )}
          </p>
        </div>
      ))}

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8 w-full">

        {/* Bannière essai gratuit */}
        {essaiActif && (
          <div style={{
            backgroundColor: joursRestants > 7 ? '#FFF8E6' : '#FDECEA',
            border: `1px solid ${joursRestants > 7 ? '#C87D2E' : '#9C2B2B'}`,
            borderRadius: 8,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontSize: 14, color: '#1B4060' }}>
              {joursRestants > 0
                ? `Essai gratuit — il vous reste ${joursRestants} jour${joursRestants > 1 ? 's' : ''} d'accès complet.`
                : `Votre essai gratuit a expiré. Choisissez un plan pour continuer.`}
            </span>
            <a
              href="/dashboard/hebergeur/abonnement"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#1B4060',
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              Voir les plans →
            </a>
          </div>
        )}

        {essaiExpire && !essaiActif && (
          <div style={{
            backgroundColor: '#FDECEA',
            border: '1px solid #9C2B2B',
            borderRadius: 8,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <span style={{ fontSize: 14, color: '#9C2B2B', fontWeight: 500 }}>
              Votre essai gratuit a expiré. Activez un abonnement pour retrouver l&apos;accès complet.
            </span>
            <a
              href="/dashboard/hebergeur/abonnement"
              style={{ fontSize: 13, fontWeight: 600, color: '#9C2B2B',
                textDecoration: 'underline', whiteSpace: 'nowrap' }}
            >
              Choisir un plan →
            </a>
          </div>
        )}

        {/* Alerte abonnement — discrète */}
        {!abonnementActif && !essaiActif && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-700">Abonnement inactif — accès aux demandes limité.</p>
            <Link href="/dashboard/hebergeur/abonnement" className="text-xs font-semibold text-amber-700 underline hover:no-underline">
              Activer
            </Link>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* KPI 1 — CA confirmé */}
          <Link href="/dashboard/hebergeur/devis" className="group relative block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Chiffre d&apos;affaires TTC des devis signés, filtré par date de séjour
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">CA confirmé</p>
              <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-[var(--color-primary)]">{fmt(ca.montant)} €</p>
            <p className="text-xs text-gray-400 mt-1">{ca.nbSejours} séjour{ca.nbSejours > 1 ? 's' : ''} · {caPeriodeLabel}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {(['DDA', 'DDM', 'T1', 'T2', 'T3', 'T4'] as PeriodeCA[]).map((p) => (
                <button
                  key={p}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPeriodeCA(p); }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${periodeCA === p ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Link>

          {/* KPI 2 — Devis en attente */}
          <Link href="/dashboard/hebergeur/devis?tab=attente" className="group relative block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Devis envoyés en attente de réponse ou de validation direction
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Devis en attente</p>
              <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-orange-600">{kpiAttenteCount} devis</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(kpiAttenteMontant)} €</p>
          </Link>

          {/* KPI 3 — À facturer */}
          <Link href="/dashboard/hebergeur/devis?tab=a-facturer" className="group relative block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Séjours signés dont l&apos;acompte ou le solde n&apos;a pas encore été facturé
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">À facturer</p>
              <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-amber-600">{kpiAFacturerCount} facture{kpiAFacturerCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400 mt-1">{fmt(kpiAFacturerMontant)} €</p>
          </Link>

          {/* KPI 4 — Impayés */}
          <Link href="/dashboard/hebergeur/devis?tab=impayes" className="group relative block bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all cursor-pointer">
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Factures émises dont le paiement n&apos;a pas été intégralement enregistré
            </div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">Impayés</p>
              <svg className={`w-4 h-4 ${kpiImpayesCount > 0 ? 'text-red-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <p className={`text-2xl font-bold ${kpiImpayesCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{kpiImpayesCount} facture{kpiImpayesCount > 1 ? 's' : ''}</p>
            <p className="text-xs text-gray-400 mt-1">{kpiImpayesCount > 0 ? `${fmt(kpiImpayesMontant)} €` : 'Aucun impayé'}</p>
          </Link>

        </div>

        {/* Actions prioritaires */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions prioritaires</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Demandes reçues */}
            <Link href="/dashboard/hebergeur/demandes" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                {demandesNonLues > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{demandesNonLues}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Demandes reçues</p>
              <p className="text-xs text-gray-500 mt-0.5">Consultez et répondez aux appels d&apos;offres</p>
            </Link>

            {/* Facturation */}
            <Link href="/dashboard/hebergeur/devis" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {actionsFacturationUrgentes > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                    {actionsFacturationUrgentes}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Devis & Facturation</p>
              <p className="text-xs text-gray-500 mt-0.5">Devis, acomptes, factures et Chorus Pro</p>
            </Link>

            {/* Planning */}
            <Link href="/dashboard/hebergeur/planning" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H18v-.008zm0 2.25h.008v.008H18V15z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Planning</p>
              <p className="text-xs text-gray-500 mt-0.5">Séjours et disponibilités</p>
            </Link>

            {/* Clients */}
            <Link href="/dashboard/hebergeur/clients" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                {rappelsAujourdhui.length > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{rappelsAujourdhui.length}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Clients</p>
              <p className="text-xs text-gray-500 mt-0.5">CRM & prospection</p>
            </Link>

          </div>
        </div>

        {/* Rappels du jour */}
        {rappelsAujourdhui.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Rappels du jour
              <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {rappelsAujourdhui.length}
              </span>
            </h2>
            <div className="space-y-2">
              {rappelsAujourdhui.slice(0, 5).map((r, i) => (
                <Link
                  key={i}
                  href="/dashboard/hebergeur/clients"
                  className="flex items-center justify-between bg-white rounded-xl border border-red-100 shadow-sm px-4 py-3 hover:border-red-300 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.client.nom}</p>
                      <p className="text-xs text-gray-500 truncate">{r.type} — {r.description}</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </Link>
              ))}
              {rappelsAujourdhui.length > 5 && (
                <Link href="/dashboard/hebergeur/clients" className="block text-center text-xs text-[var(--color-primary)] hover:underline pt-1">
                  Voir les {rappelsAujourdhui.length - 5} autres rappels &rarr;
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Séjours par période */}
        {sejoursConvention.length > 0 && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const startOfThisWeek = new Date(today);
          startOfThisWeek.setDate(today.getDate() - today.getDay() + 1);
          const endOfThisWeek = new Date(startOfThisWeek);
          endOfThisWeek.setDate(startOfThisWeek.getDate() + 6);

          const startOfLastWeek = new Date(startOfThisWeek);
          startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
          const endOfLastWeek = new Date(startOfLastWeek);
          endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);

          const startOfNextWeek = new Date(startOfThisWeek);
          startOfNextWeek.setDate(startOfThisWeek.getDate() + 7);
          const endOfNextWeek = new Date(startOfNextWeek);
          endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);

          const overlaps = (s: { dateDebut: string; dateFin: string }, from: Date, to: Date) => {
            const debut = new Date(s.dateDebut);
            const fin = new Date(s.dateFin);
            return fin >= from && debut <= to;
          };

          const sejoursLastWeek = sejoursConvention.filter((s: { dateDebut: string; dateFin: string }) => overlaps(s, startOfLastWeek, endOfLastWeek));
          const sejoursCurrent = sejoursConvention.filter((s: { dateDebut: string; dateFin: string }) => overlaps(s, startOfThisWeek, endOfThisWeek));
          const sejoursNextWeek = sejoursConvention.filter((s: { dateDebut: string; dateFin: string }) => overlaps(s, startOfNextWeek, endOfNextWeek));

          const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

          const renderCard = (s: { id: string; titre: string; lieu: string; dateDebut: string; dateFin: string; placesTotales: number; createur?: { prenom: string; nom: string } | null }, badge?: { label: string; cls: string }) => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.titre}</p>
                  {badge && (
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {s.lieu} &middot; {fmtDate(s.dateDebut)} &rarr; {fmtDate(s.dateFin)} &middot; {s.placesTotales} &eacute;l&egrave;ves
                  {s.createur && ` · ${s.createur.prenom} ${s.createur.nom}`}
                </p>
              </div>
              <Link
                href={`/dashboard/sejour/${s.id}`}
                className="shrink-0 ml-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                Espace collaboratif
              </Link>
            </div>
          );

          const hasAny = sejoursLastWeek.length > 0 || sejoursCurrent.length > 0 || sejoursNextWeek.length > 0;
          if (!hasAny) return (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">S&eacute;jours</h2>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Aucun s&eacute;jour cette semaine.
                  {sejoursConvention.length > 0 && ` ${sejoursConvention.length} séjour${sejoursConvention.length > 1 ? 's' : ''} à venir.`}
                </p>
                <Link href="/dashboard/hebergeur/planning" className="text-xs font-medium text-[var(--color-primary)] hover:underline">
                  Voir le planning &rarr;
                </Link>
              </div>
            </div>
          );

          return (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">S&eacute;jours</h2>
              <div className="space-y-4">
                {sejoursCurrent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-2">Cette semaine</p>
                    <div className="space-y-2">
                      {sejoursCurrent.map(s => renderCard(s, { label: 'En cours', cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' }))}
                    </div>
                  </div>
                )}
                {sejoursNextWeek.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Semaine prochaine</p>
                    <div className="space-y-2">
                      {sejoursNextWeek.map(s => renderCard(s, { label: 'À venir', cls: 'bg-blue-50 text-blue-700' }))}
                    </div>
                  </div>
                )}
                {sejoursLastWeek.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Semaine pr&eacute;c&eacute;dente</p>
                    <div className="space-y-2">
                      {sejoursLastWeek.map(s => renderCard(s, { label: 'Terminé', cls: 'bg-gray-100 text-gray-500' }))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-gray-400 text-center pt-1">
                  Pour tous les s&eacute;jours &rarr;{' '}
                  <Link href="/dashboard/hebergeur/planning" className="text-[var(--color-primary)] hover:underline">
                    Planning
                  </Link>
                </p>
              </div>
            </div>
          );
        })()}

        {/* Configuration */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { href: '/dashboard/hebergeur/catalogue', label: 'Catalogue', desc: 'Prestations réutilisables', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z', color: 'text-teal-500 bg-teal-50' },
              { href: '/dashboard/hebergeur/documents', label: 'Documents', desc: 'Conformité', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', color: 'text-orange-500 bg-orange-50' },
              { href: '/dashboard/hebergeur/abonnement', label: 'Abonnement', desc: 'Gérer mon offre', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 005.25 21z', color: 'text-yellow-500 bg-yellow-50' },
              { href: '/dashboard/hebergeur/inviter-enseignant', label: 'Inviter', desc: 'Proposer un séjour', icon: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z', color: 'text-[var(--color-primary)] bg-blue-50' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
                <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mb-2`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Profil centre */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Mon établissement</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-5">
            <div className="relative shrink-0">
              {centre?.imageUrl ? (
                <img src={centre.imageUrl} alt={centre.nom} className="w-20 h-20 rounded-xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-bold">
                  {centre?.nom?.[0] ?? 'H'}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white shadow-sm hover:opacity-90"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Nom</p>
                <p className="font-medium text-gray-900">{centre?.nom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Ville</p>
                <p className="font-medium text-gray-900">{centre?.ville}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Capacité</p>
                <p className="font-medium text-gray-900">{centre?.capacite} lits</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Téléphone</p>
                <p className="font-medium text-gray-900">{centre?.telephone ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Adresse</p>
                <p className="font-medium text-gray-900">{centre?.adresse}</p>
              </div>
            </div>
            <Link
              href="/dashboard/hebergeur/profil"
              className="shrink-0 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
            >
              Modifier mon profil
            </Link>
          </div>
        </div>

        {/* Rentabilité */}
        {rentabilite && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Rentabilité
            </h2>
            <Link
              href="/dashboard/hebergeur/rentabilite"
              className="group block bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 mb-1">
                    Marge brute {new Date().getFullYear()}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {rentabilite.totaux.margeTTC.toLocaleString('fr-FR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{' '}€
                  </p>
                  {rentabilite.totaux.tauxMarge !== null && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {rentabilite.totaux.tauxMarge.toLocaleString('fr-FR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}% de taux moyen
                    </p>
                  )}
                </div>
                <svg
                  className="w-5 h-5 text-gray-300 group-hover:text-[var(--color-primary)] transition-colors"
                  fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          </div>
        )}

      </main>
    </div>
  );
}
