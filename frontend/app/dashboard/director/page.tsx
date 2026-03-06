'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAllSejours, updateSejourStatus } from '@/src/lib/sejour';
import {
  getDevisAValider,
  updateDevisStatut,
  getFacturesAcompte,
  validerAcompte,
  getChorusXml,
} from '@/src/lib/devis';
import type { SejourDirecteur, StatutSejour } from '@/src/lib/sejour';
import type { Devis } from '@/src/lib/devis';

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutSejour, { label: string; cls: string }> = {
  DRAFT:      { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  SUBMITTED:  { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  APPROVED:   { label: 'Approuv\u00e9',   cls: 'bg-green-100 text-green-700' },
  REJECTED:   { label: 'Refus\u00e9',     cls: 'bg-red-100 text-red-700' },
  CONVENTION: { label: 'Convention',  cls: 'bg-indigo-100 text-indigo-700' },
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Aper&ccedil;u Chorus Pro — Format PEPPOL UBL 2.1
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              En production, ce fichier sera transmis automatiquement &agrave; chorus-pro.gouv.fr
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Pr&ecirc;t pour Chorus Pro
          </span>
        </div>

        {/* XML content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <pre className="text-xs leading-relaxed text-gray-800 bg-gray-50 rounded-lg border border-gray-200 p-4 overflow-x-auto whitespace-pre-wrap break-all font-mono">
            {xml}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? 'Copi\u00e9 !' : 'Copier le XML'}
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Carte séjour ────────────────────────────────────────────────────────────

function SejourCard({
  sejour,
  onApprove,
  onReject,
  isActing,
}: {
  sejour: SejourDirecteur;
  onApprove: (id: string) => void;
  onReject: (id: string, motif: string) => void;
  isActing: boolean;
}) {
  const [refusMode, setRefusMode] = useState(false);
  const [motif, setMotif] = useState('');

  const dateDebut = new Date(sejour.dateDebut).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const dateFin = new Date(sejour.dateFin).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const enseignant = sejour.createur
    ? `${sejour.createur.prenom} ${sejour.createur.nom}`
    : '\u2014';

  const handleConfirmRefus = () => {
    onReject(sejour.id, motif);
    setRefusMode(false);
    setMotif('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{sejour.titre}</h3>
            <StatutBadge statut={sejour.statut} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {enseignant}
            </span>
            <span>{sejour.lieu}</span>
            <span>{dateDebut} &rarr; {dateFin}</span>
            <span>{sejour.placesTotales} &eacute;l&egrave;ve{sejour.placesTotales > 1 ? 's' : ''}</span>
          </div>
        </div>

        {sejour.statut === 'SUBMITTED' && !refusMode && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onApprove(sejour.id)}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {isActing ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              Approuver
            </button>
            <button
              type="button"
              onClick={() => setRefusMode(true)}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Refuser
            </button>
          </div>
        )}
      </div>

      {refusMode && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <label className="block text-xs font-medium text-red-700">
            Motif du refus (optionnel)
          </label>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={2}
            placeholder="Expliquez la raison du refus..."
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setRefusMode(false); setMotif(''); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmRefus}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isActing && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Confirmer le refus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function DirectorDashboard() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [sejours, setSejours]     = useState<SejourDirecteur[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actingId, setActingId]   = useState<string | null>(null);
  const [filtre, setFiltre]       = useState<StatutSejour | 'ALL'>('SUBMITTED');
  const [devisAValider, setDevisAValider] = useState<Devis[]>([]);
  const [devisActingId, setDevisActingId] = useState<string | null>(null);

  // Factures
  const [factures, setFactures] = useState<Devis[]>([]);
  const [factureActingId, setFactureActingId] = useState<string | null>(null);
  const [chorusXml, setChorusXml] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const loadSejours = useCallback(async () => {
    try {
      const data = await getAllSejours();
      setSejours(data);
    } catch {
      setLoadError('Impossible de charger les s\u00e9jours.');
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
    }
  }, [user, loadSejours, loadDevis, loadFactures]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await updateSejourStatus(id, 'APPROVED');
      await loadSejours();
    } catch {
      // no-op
    } finally {
      setActingId(null);
    }
  };

  const handleDevisAction = async (devisId: string, statut: 'SELECTIONNE' | 'NON_RETENU') => {
    setDevisActingId(devisId);
    try {
      await updateDevisStatut(devisId, statut);
      await loadDevis();
      await loadFactures();
    } catch { /* ignore */ }
    setDevisActingId(null);
  };

  const handleReject = async (id: string, _motif: string) => {
    setActingId(id);
    try {
      await updateSejourStatus(id, 'REJECTED');
      await loadSejours();
    } catch {
      // no-op
    } finally {
      setActingId(null);
    }
  };

  const handleValiderAcompte = async (devisId: string) => {
    setFactureActingId(devisId);
    try {
      await validerAcompte(devisId);
      await loadFactures();
    } catch { /* ignore */ }
    setFactureActingId(null);
  };

  const handleChorusXml = async (devisId: string) => {
    try {
      const { xml } = await getChorusXml(devisId);
      setChorusXml(xml);
    } catch { /* ignore */ }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  const sejoursFiltres = filtre === 'ALL'
    ? sejours
    : sejours.filter((s) => s.statut === filtre);

  const countByStatut = (s: StatutSejour) => sejours.filter((x) => x.statut === s).length;

  const facturesNonPayees = factures.filter((f) => !f.acompteVerse);
  const facturesPayees = factures.filter((f) => f.acompteVerse);

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Chorus Pro Modal */}
      {chorusXml && <ChorusModal xml={chorusXml} onClose={() => setChorusXml(null)} />}

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">S&eacute;jour Jeunesse</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-xs font-semibold text-indigo-700">{initials}</span>
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">Directeur</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Se d&eacute;connecter
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* En-t&ecirc;te */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Validation des s&eacute;jours</h1>
          <p className="mt-1 text-sm text-gray-500">
            Approuvez ou refusez les s&eacute;jours soumis par les enseignants
          </p>
        </div>

        {/* Filtres / compteurs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['ALL',       'Tous',         sejours.length,             'bg-gray-100 text-gray-700 ring-gray-300'],
            ['SUBMITTED', 'En attente',   countByStatut('SUBMITTED'), 'bg-orange-50 text-orange-700 ring-orange-300'],
            ['APPROVED',  'Approuv\u00e9s',    countByStatut('APPROVED'),  'bg-green-50 text-green-700 ring-green-300'],
            ['REJECTED',  'Refus\u00e9s',      countByStatut('REJECTED'),  'bg-red-50 text-red-700 ring-red-300'],
            ['CONVENTION','Convention',    countByStatut('CONVENTION'),'bg-indigo-50 text-indigo-700 ring-indigo-300'],
          ] as const).map(([val, label, count, cls]) => (
            <button
              key={val}
              type="button"
              onClick={() => setFiltre(val)}
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

        {/* Liste s&eacute;jours */}
        {sejoursFiltres.length > 0 ? (
          <div className="space-y-3">
            {sejoursFiltres.map((s) => (
              <SejourCard
                key={s.id}
                sejour={s}
                onApprove={handleApprove}
                onReject={handleReject}
                isActing={actingId === s.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50">
              <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">Aucun s&eacute;jour &agrave; afficher</h2>
            <p className="mt-1 text-sm text-gray-500">
              {filtre === 'SUBMITTED'
                ? 'Aucun s\u00e9jour en attente de validation.'
                : 'Aucun s\u00e9jour dans cette cat\u00e9gorie.'}
            </p>
          </div>
        )}

        {/* ── Devis &agrave; valider ─────────────────────────────────────────── */}
        {devisAValider.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Devis &agrave; valider
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {devisAValider.length}
              </span>
            </h2>
            <div className="space-y-3">
              {devisAValider.map((dv) => (
                <div key={dv.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{dv.centre?.nom ?? 'Centre'}</h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Soumis par l&apos;enseignant
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>S&eacute;jour : {dv.demande?.sejour?.titre ?? dv.demande?.titre ?? '\u2014'}</span>
                        {dv.demande?.enseignant && <span>Enseignant : {dv.demande.enseignant.prenom} {dv.demande.enseignant.nom}</span>}
                        <span>{dv.centre?.ville ?? '\u2014'}</span>
                        <span>Total : {dv.montantTotal} &euro;</span>
                        <span>Par &eacute;l&egrave;ve : {dv.montantParEleve} &euro;</span>
                      </div>
                      {dv.description && <p className="mt-2 text-xs text-gray-600">{dv.description}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDevisAction(dv.id, 'SELECTIONNE')}
                        disabled={devisActingId === dv.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDevisAction(dv.id, 'NON_RETENU')}
                        disabled={devisActingId === dv.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Factures d'acompte &agrave; valider ──────────────────────────── */}
        {facturesNonPayees.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Factures d&apos;acompte &agrave; valider
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
                          {f.demande?.sejour?.titre ?? f.demande?.titre ?? 'S\u00e9jour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {f.numeroFacture}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>H&eacute;bergeur : {f.centre?.nom ?? '\u2014'}</span>
                        <span>
                          Montant acompte :{' '}
                          <span className="font-bold text-amber-700">{fmt(Number(f.montantAcompte ?? 0))} &euro;</span>
                        </span>
                        <span>Total TTC : {fmt(Number(f.montantTTC ?? f.montantTotal))} &euro;</span>
                        {f.dateFacture && (
                          <span>Date : {new Date(f.dateFacture).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleValiderAcompte(f.id)}
                        disabled={factureActingId === f.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {factureActingId === f.id ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : null}
                        Valider le paiement acompte
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChorusXml(f.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Envoyer &agrave; Chorus Pro
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Factures pay&eacute;es ───────────────────────────────────────── */}
        {facturesPayees.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Acomptes valid&eacute;s
              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                {facturesPayees.length}
              </span>
            </h2>
            <div className="space-y-3">
              {facturesPayees.map((f) => (
                <div key={f.id} className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {f.demande?.sejour?.titre ?? f.demande?.titre ?? 'S\u00e9jour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Acompte vers&eacute; &mdash; {f.numeroFacture}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>H&eacute;bergeur : {f.centre?.nom ?? '\u2014'}</span>
                        <span>Montant : {fmt(Number(f.montantAcompte ?? 0))} &euro;</span>
                        {f.dateVersementAcompte && (
                          <span>Vers&eacute; le : {new Date(f.dateVersementAcompte).toLocaleDateString('fr-FR')}</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChorusXml(f.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Voir XML Chorus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
