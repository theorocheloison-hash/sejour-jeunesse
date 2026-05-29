'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  getDevisForSejourDirect,
  envoyerDevisDirect,
  facturerAcompte,
  facturerSolde,
  ajouterVersement,
  getVersements,
  supprimerVersement,
} from '@/src/lib/devis';
import type { Devis as DevisType, VersementPaiement } from '@/src/lib/devis';
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

  // ── Invitation direction (devis collab) ─────────────────────
  const [showInvitationDirection, setShowInvitationDirection] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [invitationSending, setInvitationSending] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const signatureFileRef = useRef<HTMLInputElement>(null);

  // ── Pipeline facturation ──────────────────────────────────
  const [versements, setVersements] = useState<VersementPaiement[]>([]);
  const [versementsLoading, setVersementsLoading] = useState(false);
  const [facturerLoading, setFacturerLoading] = useState(false);
  const [showAddVersement, setShowAddVersement] = useState(false);
  const [versementForm, setVersementForm] = useState({ montant: '', datePaiement: '', reference: '' });
  const [versementSaving, setVersementSaving] = useState(false);

  useEffect(() => {
    if (!isDirect) return;
    setDirectDevisLoading(true);
    getDevisForSejourDirect(sejourId)
      .then(devis => setDirectDevis(devis[0] ?? null))
      .catch(() => {})
      .finally(() => setDirectDevisLoading(false));
  }, [isDirect, sejourId]);

  // Devis actif (DIRECT ou COLLAB) normalisé pour le pipeline facturation
  const activeDevisForFacturation = isDirect
    ? directDevis
      ? {
          id: directDevis.id,
          statut: directDevis.statut,
          montantTTC: Number(directDevis.montantTTC ?? 0),
          montantAcompte: Number(directDevis.montantAcompte ?? 0),
          pourcentageAcompte: Number(directDevis.pourcentageAcompte ?? 30),
        }
      : null
    : budgetData?.devis
      ? {
          id: budgetData.devis.id,
          statut: budgetData.devis.statut,
          montantTTC: Number(budgetData.devis.montantTTC ?? budgetData.devis.montantTotal ?? 0),
          montantAcompte: Number(budgetData.devis.montantAcompte ?? 0),
          pourcentageAcompte: Number(budgetData.devis.pourcentageAcompte ?? 30),
        }
      : null;

  const activeDevisId = activeDevisForFacturation?.id ?? null;
  const activeDevisStatut = activeDevisForFacturation?.statut ?? null;

  useEffect(() => {
    if (!activeDevisId || !activeDevisStatut) return;
    const FACTURATION_STATUTS = ['SELECTIONNE', 'SIGNE_DIRECTION', 'FACTURE_ACOMPTE', 'FACTURE_SOLDE'];
    if (!FACTURATION_STATUTS.includes(activeDevisStatut)) return;
    setVersementsLoading(true);
    getVersements(activeDevisId)
      .then(setVersements)
      .catch(() => {})
      .finally(() => setVersementsLoading(false));
  }, [activeDevisId, activeDevisStatut]);

  const handleFacturerAcompte = async () => {
    if (!activeDevisId) return;
    setFacturerLoading(true);
    try {
      await facturerAcompte(activeDevisId);
      if (isDirect) {
        const devis = await getDevisForSejourDirect(sejourId);
        setDirectDevis(devis[0] ?? null);
      } else {
        await onBudgetReload();
      }
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
      await facturerSolde(activeDevisId);
      if (isDirect) {
        const devis = await getDevisForSejourDirect(sejourId);
        setDirectDevis(devis[0] ?? null);
      } else {
        await onBudgetReload();
      }
    } catch {
      onError('Erreur lors de la facturation du solde');
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
      );
      setVersements(await getVersements(activeDevisId));
      setVersementForm({ montant: '', datePaiement: '', reference: '' });
      setShowAddVersement(false);
    } catch {
      onError('Erreur lors de l\'ajout du versement');
    } finally {
      setVersementSaving(false);
    }
  };

  const handleSupprimerVersement = async (versementId: string) => {
    if (!activeDevisId) return;
    try {
      await supprimerVersement(activeDevisId, versementId);
      setVersements(await getVersements(activeDevisId));
    } catch {
      onError('Erreur lors de la suppression du versement');
    }
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

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Facturation</h3>

        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${
            ad.statut === 'SELECTIONNE' || ad.statut === 'SIGNE_DIRECTION' ? 'bg-amber-400' :
            ad.statut === 'FACTURE_ACOMPTE' ? 'bg-blue-500' :
            'bg-green-500'
          }`} />
          <span className="text-sm text-gray-700">
            {ad.statut === 'SELECTIONNE' || ad.statut === 'SIGNE_DIRECTION' ? 'En attente d\'acompte' :
             ad.statut === 'FACTURE_ACOMPTE' ? 'Acompte facturé' :
             'Soldé'}
          </span>
        </div>

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

        {versementsLoading ? (
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
                  {v.reference && <span className="text-gray-400">Réf: {v.reference}</span>}
                </div>
                <button
                  onClick={() => handleSupprimerVersement(v.id)}
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
            <p className="text-xs font-semibold text-gray-700">Nouveau versement</p>
            <div className="grid grid-cols-3 gap-2">
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
                onClick={() => { setShowAddVersement(false); setVersementForm({ montant: '', datePaiement: '', reference: '' }); }}
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
          {ad.statut !== 'FACTURE_SOLDE' && (
            <button
              onClick={() => setShowAddVersement(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              + Ajouter un versement
            </button>
          )}
          {(ad.statut === 'SELECTIONNE' || ad.statut === 'SIGNE_DIRECTION') && (
            <button
              onClick={handleFacturerAcompte}
              disabled={facturerLoading}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {facturerLoading ? 'Facturation...' : '📄 Facturer l\'acompte'}
            </button>
          )}
          {ad.statut === 'FACTURE_ACOMPTE' && (
            <button
              onClick={handleFacturerSolde}
              disabled={facturerLoading}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {facturerLoading ? 'Facturation...' : '📄 Facturer le solde'}
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
                    directDevis.statut === 'EN_ATTENTE' ? 'bg-orange-100 text-orange-700' :
                    directDevis.statut === 'SELECTIONNE' ? 'bg-green-100 text-green-700' :
                    directDevis.statut === 'SIGNE_DIRECTION' ? 'bg-purple-100 text-purple-700' :
                    directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'bg-blue-100 text-blue-700' :
                    directDevis.statut === 'FACTURE_ACOMPTE' ? 'bg-indigo-100 text-indigo-700' :
                    directDevis.statut === 'FACTURE_SOLDE' ? 'bg-teal-100 text-teal-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {directDevis.statut === 'EN_ATTENTE' ? 'Brouillon' :
                     directDevis.statut === 'SELECTIONNE' ? 'Signé' :
                     directDevis.statut === 'SIGNE_DIRECTION' ? 'Signé direction' :
                     directDevis.statut === 'EN_ATTENTE_VALIDATION' ? 'En attente direction' :
                     directDevis.statut === 'FACTURE_ACOMPTE' ? 'Facture acompte' :
                     directDevis.statut === 'FACTURE_SOLDE' ? 'Facture solde' :
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
                    onClick={async () => {
                      setEnvoyerLoading(true);
                      setEnvoyerSuccess(false);
                      try {
                        await envoyerDevisDirect(directDevis.id);
                        setEnvoyerSuccess(true);
                        const devis = await getDevisForSejourDirect(sejourId);
                        setDirectDevis(devis[0] ?? null);
                      } catch { onError('Erreur lors de l\'envoi du devis'); }
                      finally { setEnvoyerLoading(false); }
                    }}
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

                <Link
                  href={`/dashboard/hebergeur/devis/nouveau?sejourDirectId=${sejourId}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  Modifier le devis
                </Link>
              </div>

              {(directDevis.statut === 'SELECTIONNE' || directDevis.statut === 'SIGNE_DIRECTION') && directDevis.nomSignataireDirecteur && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-green-800">✅ Devis signé</p>
                  <p className="text-xs text-green-700 mt-1">
                    Signé par {directDevis.nomSignataireDirecteur}
                    {directDevis.dateSignatureDirecteur && ` le ${new Date(directDevis.dateSignatureDirecteur).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>
              )}

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
              nomEmetteur: d.nomEntreprise ?? c?.nom ?? '',
              adresseEmetteur: d.adresseEntreprise ?? [c?.adresse, c?.codePostal, c?.ville].filter(Boolean).join(', '),
              siretEmetteur: d.siretEntreprise ?? c?.siret ?? undefined,
              emailEmetteur: d.emailEntreprise ?? c?.email ?? undefined,
              telEmetteur: d.telEntreprise ?? c?.telephone ?? undefined,
              tvaEmetteur: c?.tvaIntracommunautaire ?? undefined,
              ibanEmetteur: c?.iban ?? undefined,
              nomDestinataire: createur ? `${createur.prenom} ${createur.nom}` : '',
              etablissementNom: createur?.memberships?.[0]?.organisation.nom ?? undefined,
              adresseDestinataire: createur?.memberships?.[0]?.organisation.ville ?? undefined,
              emailDestinataire: createur?.email ?? undefined,
              telDestinataire: createur?.telephone ?? undefined,
              titreSejour: s?.titre ?? '',
              lieuSejour: s?.lieu ?? '',
              dateDebutSejour: s?.dateDebut,
              dateFinSejour: s?.dateFin,
              nombreEleves: s?.placesTotales ?? undefined,
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
              pourcentageAcompte: Number(d.pourcentageAcompte) || undefined,
              conditionsAnnulation: d.conditionsAnnulation ?? undefined,
              signatureDirecteur: d.signatureDirecteur ?? null,
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
                  {user.role === 'HEBERGEUR' && (
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
    </>
  );
}
