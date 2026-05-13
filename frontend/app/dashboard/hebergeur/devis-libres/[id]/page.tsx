'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getDevisLibre, envoyerDevisLibre, deleteDevisLibre, ajouterVersementDevisLibre,
} from '@/src/lib/devis-libres';
import type { DevisLibre, StatutDevisLibre } from '@/src/lib/devis-libres';

const STATUT_BADGE: Record<StatutDevisLibre, { label: string; cls: string }> = {
  BROUILLON: { label: 'Brouillon',         cls: 'bg-gray-100 text-gray-600' },
  ENVOYE:    { label: 'Envoyé',            cls: 'bg-amber-100 text-amber-700' },
  ACCEPTE:   { label: 'Accepté',           cls: 'bg-green-100 text-green-700' },
  REFUSE:    { label: 'Refusé',            cls: 'bg-red-100 text-red-700' },
  PAYE:      { label: 'Payé',              cls: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' },
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
const fmtMoney = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DevisLibreDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();

  const [devis, setDevis] = useState<DevisLibre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<null | 'envoi' | 'suppression' | 'versement'>(null);
  const [copied, setCopied] = useState(false);

  // Versement form
  const [versForm, setVersForm] = useState({ montant: '', datePaiement: '', reference: '' });

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'HEBERGEUR')) router.replace('/login');
  }, [isLoading, user, router]);

  // ── Load devis ──
  useEffect(() => {
    if (!user || !id) return;
    getDevisLibre(id)
      .then(setDevis)
      .catch(() => setError('Devis introuvable ou accès refusé.'))
      .finally(() => setLoading(false));
  }, [user, id]);

  // ── Handlers ──
  const handleEnvoyer = async () => {
    if (!devis || !devis.emailClient) return;
    setAction('envoi');
    setError(null);
    try {
      const updated = await envoyerDevisLibre(devis.id);
      setDevis(updated);
    } catch {
      setError("Erreur lors de l'envoi du devis.");
    } finally {
      setAction(null);
    }
  };

  const handleDelete = async () => {
    if (!devis) return;
    if (!window.confirm(`Supprimer définitivement le devis ${devis.numeroDevis ?? ''} ?`)) return;
    setAction('suppression');
    setError(null);
    try {
      await deleteDevisLibre(devis.id);
      router.push('/dashboard/hebergeur');
    } catch {
      setError('Erreur lors de la suppression.');
      setAction(null);
    }
  };

  const handleAddVersement = async () => {
    if (!devis) return;
    const montant = parseFloat(versForm.montant);
    if (!montant || montant <= 0 || !versForm.datePaiement) {
      setError('Montant et date de paiement obligatoires.');
      return;
    }
    setAction('versement');
    setError(null);
    try {
      const updated = await ajouterVersementDevisLibre(
        devis.id,
        montant,
        versForm.datePaiement,
        versForm.reference.trim() || undefined,
      );
      setDevis(updated);
      setVersForm({ montant: '', datePaiement: '', reference: '' });
    } catch {
      setError("Erreur lors de l'ajout du versement.");
    } finally {
      setAction(null);
    }
  };

  const handleCopyLink = async () => {
    if (!devis?.tokenSignature) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/devis-libre/signer/${devis.tokenSignature}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  // ── Render ──
  if (isLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (error && !devis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-md w-full text-center">
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard/hebergeur')} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  if (!devis) return null;

  const badge = STATUT_BADGE[devis.statut] ?? STATUT_BADGE.BROUILLON;
  const ttc = Number(devis.montantTTC ?? 0);
  const verse = Number(devis.montantVerseTotal ?? 0);
  const progression = ttc > 0 ? Math.min(100, (verse / ttc) * 100) : 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const lienSignature = devis.tokenSignature ? `${origin}/devis-libre/signer/${devis.tokenSignature}` : '';
  const dernierVersement = (devis.versements ?? []).slice().sort((a, b) =>
    new Date(b.datePaiement).getTime() - new Date(a.datePaiement).getTime()
  )[0];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <button
              onClick={() => router.push('/dashboard/hebergeur')}
              className="text-sm text-[var(--color-primary)] hover:underline font-medium"
            >
              &larr; Mes devis
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-700">{devis.numeroDevis ?? '—'}</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* ── Section 1 : Client & événement ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Client &amp; événement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Client</p>
              <p className="font-medium text-gray-900">
                {devis.nomClient}{devis.prenomClient ? ` ${devis.prenomClient}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Type d&apos;événement</p>
              <p className="font-medium text-gray-900">{devis.typeEvenement ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="font-medium text-gray-900 break-all">
                {devis.emailClient ?? <span className="text-gray-400">—</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Téléphone</p>
              <p className="font-medium text-gray-900">
                {devis.telClient ?? <span className="text-gray-400">—</span>}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400">Adresse</p>
              <p className="font-medium text-gray-900">
                {devis.adresseClient ?? <span className="text-gray-400">—</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Date début</p>
              <p className="font-medium text-gray-900">{fmtDate(devis.dateDebut)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Date fin</p>
              <p className="font-medium text-gray-900">{fmtDate(devis.dateFin)}</p>
            </div>
            {devis.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{devis.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2 : Montants ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Montants</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">HT</p>
              <p className="text-base font-bold text-gray-900">{fmtMoney(Number(devis.montantHT ?? 0))} €</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">TVA</p>
              <p className="text-base font-bold text-gray-900">{fmtMoney(Number(devis.montantTVA ?? 0))} €</p>
            </div>
            <div className="rounded-lg bg-[var(--color-primary-light)] px-4 py-3">
              <p className="text-xs text-gray-600">Total TTC</p>
              <p className="text-base font-bold text-[var(--color-primary)]">{fmtMoney(ttc)} €</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-4 py-3">
              <p className="text-xs text-amber-700">Acompte ({devis.pourcentageAcompte ?? 30}%)</p>
              <p className="text-base font-bold text-amber-700">{fmtMoney(Number(devis.montantAcompte ?? 0))} €</p>
            </div>
          </div>
        </div>

        {/* ── Section 3 : Prestations ─────────────────────────────────────── */}
        {(devis.lignes ?? []).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Prestations</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--color-primary)] text-white">
                    <th className="text-left px-3 py-2 rounded-l-lg">Description</th>
                    <th className="text-right px-3 py-2">Qté</th>
                    <th className="text-right px-3 py-2">PU HT</th>
                    <th className="text-right px-3 py-2">TVA</th>
                    <th className="text-right px-3 py-2 rounded-r-lg">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(devis.lignes ?? []).map((l, i) => (
                    <tr key={l.id ?? i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-900">{l.description}</td>
                      <td className="px-3 py-2 text-right">{l.quantite}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(Number(l.prixUnitaire))} €</td>
                      <td className="px-3 py-2 text-right">{l.tva} %</td>
                      <td className="px-3 py-2 text-right font-medium">{fmtMoney(Number(l.totalTTC))} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Section 4 : Actions selon statut ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Actions</h2>

          {/* BROUILLON ────────────────────────────────────────────────────── */}
          {devis.statut === 'BROUILLON' && (
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start">
              <button
                onClick={() => router.push(`/dashboard/hebergeur/devis-libres/nouveau?edit=${devis.id}`)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Modifier
              </button>
              <button
                onClick={handleEnvoyer}
                disabled={action !== null || !devis.emailClient}
                title={!devis.emailClient ? "Email client requis pour l'envoi" : undefined}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {action === 'envoi' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi...
                  </>
                ) : 'Envoyer au client'}
              </button>
              <button
                onClick={handleDelete}
                disabled={action !== null}
                className="ml-auto text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                Supprimer
              </button>
              {!devis.emailClient && (
                <p className="w-full text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Email client requis avant de pouvoir envoyer le devis. Modifie le devis pour l&apos;ajouter.
                </p>
              )}
            </div>
          )}

          {/* ENVOYE ───────────────────────────────────────────────────────── */}
          {devis.statut === 'ENVOYE' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
                <svg className="h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-800">En attente de signature client</p>
              </div>

              {devis.contratUrl && (
                <a
                  href={devis.contratUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Voir le contrat PDF
                </a>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Lien de signature</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lienSignature}
                    className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {copied ? '✓ Copié' : 'Copier le lien'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ACCEPTE ──────────────────────────────────────────────────────── */}
          {devis.statut === 'ACCEPTE' && (
            <div className="space-y-5">
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-3">
                <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-800">
                  Signé le {devis.dateSignatureClient ? fmtDate(devis.dateSignatureClient) : '—'}
                </p>
              </div>

              {devis.contratUrl && (
                <a
                  href={devis.contratUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Voir le contrat PDF
                </a>
              )}

              {/* Progression paiement */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Paiement</span>
                  <span>{fmtMoney(verse)} € / {fmtMoney(ttc)} €</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${progression}%`,
                      backgroundColor: progression >= 100 ? '#16A34A' : '#F59E0B',
                    }}
                  />
                </div>
              </div>

              {/* Liste versements */}
              {(devis.versements ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versements reçus</p>
                  <div className="space-y-1">
                    {(devis.versements ?? []).map(v => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{fmtMoney(Number(v.montant))} €</p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(v.datePaiement)}
                            {v.reference ? ` · Réf. ${v.reference}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulaire ajout versement */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Ajouter un versement</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Montant (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={versForm.montant}
                      onChange={e => setVersForm(f => ({ ...f, montant: e.target.value }))}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Date</label>
                    <input
                      type="date"
                      value={versForm.datePaiement}
                      onChange={e => setVersForm(f => ({ ...f, datePaiement: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Référence (optionnel)</label>
                    <input
                      type="text"
                      value={versForm.reference}
                      onChange={e => setVersForm(f => ({ ...f, reference: e.target.value }))}
                      placeholder="ex : VIR-2026-0042"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleAddVersement}
                      disabled={action !== null || !versForm.montant || !versForm.datePaiement}
                      className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {action === 'versement' ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Ajout...
                        </>
                      ) : '+ Ajouter'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAYE ────────────────────────────────────────────────────────── */}
          {devis.statut === 'PAYE' && (
            <div className="space-y-5">
              <div className="rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-primary)] px-4 py-3 flex items-center gap-3">
                <svg className="h-5 w-5 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-[var(--color-primary)] font-medium">
                  Payé intégralement
                  {dernierVersement && ` — dernier versement le ${fmtDate(dernierVersement.datePaiement)}`}
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Paiement</span>
                  <span>{fmtMoney(verse)} € / {fmtMoney(ttc)} €</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: '100%' }} />
                </div>
              </div>

              {(devis.versements ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Versements</p>
                  <div className="space-y-1">
                    {(devis.versements ?? []).map(v => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{fmtMoney(Number(v.montant))} €</p>
                          <p className="text-xs text-gray-500">
                            {fmtDate(v.datePaiement)}
                            {v.reference ? ` · Réf. ${v.reference}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REFUSE ───────────────────────────────────────────────────────── */}
          {devis.statut === 'REFUSE' && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">Ce devis a été refusé par le client.</p>
            </div>
          )}
        </div>

        {/* ── Section 5 : Notes internes ─────────────────────────────────── */}
        {devis.notesInternes && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes internes</h2>
            <p className="text-xs text-gray-400 mb-3">Non visibles par le client.</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {devis.notesInternes}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
