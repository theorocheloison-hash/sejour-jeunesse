'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { getAllSejours, updateSejourStatus, getSejourDetail, soumettreAuRectorat, getDossierPedagogique } from '@/src/lib/sejour';
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
import { Logo } from '@/app/components/Logo';
import type { Devis, LigneDevis } from '@/src/lib/devis';
import { getBudgetData } from '@/src/lib/collaboration';
import type { BudgetData } from '@/src/lib/collaboration';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutSejour, { label: string; cls: string }> = {
  DRAFT:      { label: 'Brouillon',  cls: 'bg-gray-100 text-gray-600' },
  SUBMITTED:  { label: 'En attente', cls: 'bg-orange-100 text-orange-700' },
  APPROVED:   { label: 'Approuvé',   cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  REJECTED:   { label: 'Refusé',     cls: 'bg-red-100 text-red-700' },
  CONVENTION:      { label: 'Convention',       cls: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' },
  SOUMIS_RECTORAT: { label: 'Soumis rectorat', cls: 'bg-purple-100 text-purple-700' },
  SIGNE_DIRECTION: { label: 'Signé direction', cls: 'bg-purple-100 text-purple-700' },
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

// ─── Modale Détail Séjour ───────────────────────────────────────────────────

function SejourDetailModal({
  detail,
  onClose,
  onApprove,
  onReject,
  onSoumettreRectorat,
  emailRectoratConfigured,
  isActing,
}: {
  detail: SejourDetail;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string, motif: string) => void;
  onSoumettreRectorat: (id: string) => void;
  emailRectoratConfigured: boolean;
  isActing: boolean;
}) {
  const [refusMode, setRefusMode] = useState(false);
  const [motif, setMotif] = useState('');
  const [dossier, setDossier] = useState<DossierPedagogiqueData | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['infos']));
  const toggleSection = (key: string) => setOpenSections(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const c = detail.createur;
  const signees = detail.autorisations.filter((a) => a.signeeAt).length;

  useEffect(() => {
    setDossierLoading(true);
    getDossierPedagogique(detail.id)
      .then(setDossier)
      .catch(() => {})
      .finally(() => setDossierLoading(false));
  }, [detail.id]);

  useEffect(() => {
    setBudgetLoading(true);
    getBudgetData(detail.id)
      .then(setBudgetData)
      .catch(() => {})
      .finally(() => setBudgetLoading(false));
  }, [detail.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900 truncate">{detail.titre}</h2>
              <StatutBadge statut={detail.statut} />
            </div>
            <p className="text-xs text-gray-500">{detail.lieu} — {fmtDate(detail.dateDebut)} → {fmtDate(detail.dateFin)}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-1">

          {/* Infos séjour */}
          <button
            onClick={() => toggleSection('infos')}
            className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Informations du séjour</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('infos') ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openSections.has('infos') && (
            <div className="py-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-gray-500">Élèves</span><p className="font-medium">{detail.placesTotales}</p></div>
                {detail.niveauClasse && <div><span className="text-gray-500">Niveau</span><p className="font-medium">{detail.niveauClasse}</p></div>}
                {detail.prix > 0 && <div><span className="text-gray-500">Prix / élève</span><p className="font-medium">{detail.prix.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</p></div>}
                {detail.hebergements?.[0] && (
                  <div className="col-span-2"><span className="text-gray-500">Hébergement</span><p className="font-medium">{detail.hebergements[0].nom}{detail.hebergements[0].ville ? `, ${detail.hebergements[0].ville}` : ''}</p></div>
                )}
              </div>
            </div>
          )}

          {/* Enseignant / Établissement */}
          {c && (
            <>
              <button
                onClick={() => toggleSection('enseignant')}
                className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enseignant & Établissement</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('enseignant') ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {openSections.has('enseignant') && (
                <div className="py-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-gray-500">Enseignant</span><p className="font-medium">{c.prenom} {c.nom}</p></div>
                    <div><span className="text-gray-500">Email</span><p className="font-medium">{c.email}</p></div>
                    {c.telephone && <div><span className="text-gray-500">Téléphone</span><p className="font-medium">{c.telephone}</p></div>}
                    {c.etablissementNom && <div><span className="text-gray-500">Établissement</span><p className="font-medium">{c.etablissementNom}</p></div>}
                    {c.etablissementAdresse && <div><span className="text-gray-500">Adresse</span><p className="font-medium">{c.etablissementAdresse}{c.etablissementVille ? `, ${c.etablissementVille}` : ''}</p></div>}
                    {c.etablissementUai && <div><span className="text-gray-500">UAI</span><p className="font-medium">{c.etablissementUai}</p></div>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Accompagnateurs */}
          <button
            onClick={() => toggleSection('accompagnateurs')}
            className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Accompagnateurs ({detail.accompagnateurs.length})</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('accompagnateurs') ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openSections.has('accompagnateurs') && (
            <div className="py-3">
              {detail.accompagnateurs.length > 0 ? (
                <div className="space-y-2">
                  {detail.accompagnateurs.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.prenom} {a.nom}</p>
                        <p className="text-xs text-gray-500">{a.email}{a.telephone ? ` — ${a.telephone}` : ''}</p>
                      </div>
                      {a.signeeAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Signé
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">En attente</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Aucun accompagnateur ajouté</p>
              )}
            </div>
          )}

          {/* Autorisations parentales */}
          <button
            onClick={() => toggleSection('autorisations')}
            className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Autorisations parentales ({signees}/{detail.autorisations.length})</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('autorisations') ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openSections.has('autorisations') && (
            <div className="py-3">
              {detail.autorisations.length > 0 ? (
                <div className="space-y-1.5">
                  {detail.autorisations.map((a) => (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.elevePrenom} {a.eleveNom}</p>
                        <p className="text-xs text-gray-500">{a.parentEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.signeeAt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Signée
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">En attente</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Aucune autorisation parentale</p>
              )}
            </div>
          )}

          {/* Budget prévisionnel */}
          <button
            onClick={() => toggleSection('budget')}
            className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget prévisionnel</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('budget') ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openSections.has('budget') && (
            <div className="py-3">
              {budgetLoading && (
                <div className="flex justify-center py-4">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                </div>
              )}

              {!budgetLoading && budgetData && (() => {
                const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const d = budgetData.devis;
                const totalHebergeur = d?.lignes.reduce((sum, l) => sum + l.totalTTC, 0) ?? 0;
                const totalCompl = budgetData.lignesCompl.reduce((sum, l) => sum + l.montant, 0);
                const totalDepenses = totalHebergeur + totalCompl;
                const totalRecettes = budgetData.recettes.reduce((sum, r) => sum + r.montant, 0);
                const solde = totalRecettes - totalDepenses;

                return (
                  <div className="space-y-4 text-sm">

                    {/* Prestations hébergeur */}
                    {d && d.lignes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Prestations hébergeur — {d.centre?.nom ?? ''}
                        </p>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-1 font-medium text-gray-600">Description</th>
                              <th className="text-right py-1 font-medium text-gray-600">Qté</th>
                              <th className="text-right py-1 font-medium text-gray-600">PU HT</th>
                              <th className="text-right py-1 font-medium text-gray-600">Total TTC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.lignes.map((l, i) => (
                              <tr key={i} className="border-b border-gray-50">
                                <td className="py-1 text-gray-700">{l.description}</td>
                                <td className="py-1 text-right text-gray-500">{l.quantite}</td>
                                <td className="py-1 text-right text-gray-500">{fmt(l.prixUnitaire)} €</td>
                                <td className="py-1 text-right font-medium text-gray-900">{fmt(l.totalTTC)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Dépenses complémentaires */}
                    {budgetData.lignesCompl.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dépenses complémentaires</p>
                        <table className="w-full text-xs border-collapse">
                          <tbody>
                            {budgetData.lignesCompl.map((l) => (
                              <tr key={l.id} className="border-b border-gray-50">
                                <td className="py-1 text-gray-500">{l.categorie}</td>
                                <td className="py-1 text-gray-700">{l.description}</td>
                                <td className="py-1 text-right font-medium text-gray-900">{fmt(l.montant)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Recettes */}
                    {budgetData.recettes.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recettes</p>
                        <table className="w-full text-xs border-collapse">
                          <tbody>
                            {budgetData.recettes.map((r) => (
                              <tr key={r.id} className="border-b border-gray-50">
                                <td className="py-1 text-gray-700">{r.source}</td>
                                <td className="py-1 text-right font-medium text-gray-900">{fmt(r.montant)} €</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Récapitulatif */}
                    <div className="border-t border-gray-200 pt-3 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Total dépenses</span>
                        <span>{fmt(totalDepenses)} €</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Total recettes</span>
                        <span>{fmt(totalRecettes)} €</span>
                      </div>
                      <div className={`flex justify-between text-sm font-semibold pt-1 border-t border-gray-200 ${solde >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        <span>Solde</span>
                        <span>{solde >= 0 ? '+' : ''}{fmt(solde)} €</span>
                      </div>
                    </div>

                    {!d && budgetData.lignesCompl.length === 0 && budgetData.recettes.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">Aucune donnée budget disponible.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Projet pédagogique ── */}
          <button
            onClick={() => toggleSection('projet')}
            className="w-full flex items-center justify-between py-3 text-left border-b border-gray-100 hover:bg-gray-50 -mx-6 px-6 transition-colors"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projet pédagogique</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${openSections.has('projet') ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          {openSections.has('projet') && (
          <div className="py-3">

            {dossierLoading && (
              <div className="flex justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            )}

            {!dossierLoading && dossier && (() => {
              const planByDay = dossier.planningActivites.reduce<Record<string, typeof dossier.planningActivites>>((acc, p) => {
                const day = p.date.split('T')[0];
                if (!acc[day]) acc[day] = [];
                acc[day].push(p);
                return acc;
              }, {});

              const totalAuto = dossier.autorisations.filter(a => a.signeeAt).length;
              const totalOMSignes = dossier.accompagnateurs.filter(a => a.signeeAt).length;

              return (
                <div className="space-y-4">

                  {/* Thématiques */}
                  {dossier.thematiquesPedagogiques?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Thématiques pédagogiques</p>
                      <div className="flex flex-wrap gap-1.5">
                        {dossier.thematiquesPedagogiques.map((t, i) => (
                          <span key={i} className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statut checklist */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${totalAuto === dossier.autorisations.length && dossier.autorisations.length > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      <span>{totalAuto === dossier.autorisations.length && dossier.autorisations.length > 0 ? '✓' : '⚠'}</span>
                      Autorisations {totalAuto}/{dossier.autorisations.length}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${totalOMSignes === dossier.accompagnateurs.length && dossier.accompagnateurs.length > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      <span>{totalOMSignes === dossier.accompagnateurs.length && dossier.accompagnateurs.length > 0 ? '✓' : '⚠'}</span>
                      Ordres de mission {totalOMSignes}/{dossier.accompagnateurs.length}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${dossier.planningActivites.length > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      <span>{dossier.planningActivites.length > 0 ? '✓' : '⚠'}</span>
                      Planning {dossier.planningActivites.length > 0 ? 'renseigné' : 'manquant'}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-2 ${dossier.thematiquesPedagogiques?.length > 0 ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                      <span>{dossier.thematiquesPedagogiques?.length > 0 ? '✓' : '⚠'}</span>
                      Projet pédago {dossier.thematiquesPedagogiques?.length > 0 ? 'renseigné' : 'manquant'}
                    </div>
                  </div>

                  {/* Programme */}
                  {Object.keys(planByDay).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5">Programme</p>
                      {Object.entries(planByDay)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([day, items]) => (
                          <div key={day} className="mb-2">
                            <p className="text-xs font-medium text-[var(--color-primary)] mb-1">
                              {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                            <table className="w-full text-xs">
                              <tbody>
                                {items.map((p) => (
                                  <tr key={p.id} className="border-b border-gray-50">
                                    <td className="py-0.5 pr-3 font-mono text-gray-400 w-20">{p.heureDebut}–{p.heureFin}</td>
                                    <td className="py-0.5 text-gray-800">{p.titre}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          )}

          {/* Refus motif */}
          {refusMode && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
              <label className="block text-xs font-medium text-red-700">Motif du refus (optionnel)</label>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={2}
                placeholder="Expliquez la raison du refus..."
                className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setRefusMode(false); setMotif(''); }} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">Annuler</button>
                <button
                  type="button"
                  onClick={() => { onReject(detail.id, motif); setRefusMode(false); setMotif(''); }}
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

        {/* Footer avec actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <a
            href={`/dashboard/sejour/${detail.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors mr-auto"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Espace collaboratif
          </a>
          {detail.statut === 'SUBMITTED' && !refusMode && (
            <>
              <button
                type="button"
                onClick={() => setRefusMode(true)}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                Refuser
              </button>
              <button
                type="button"
                onClick={() => onApprove(detail.id)}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {isActing ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                )}
                Approuver
              </button>
            </>
          )}
          {(detail.statut === 'CONVENTION' || detail.statut === 'APPROVED' || detail.statut === 'SIGNE_DIRECTION') && (
            emailRectoratConfigured ? (
              <button
                type="button"
                onClick={() => onSoumettreRectorat(detail.id)}
                disabled={isActing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {isActing ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                )}
                Soumettre au rectorat
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-medium text-amber-700">
                Configurez d&apos;abord l&apos;email DSDEN dans vos paramètres
              </span>
            )
          )}
          <button onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modale Détail Devis ────────────────────────────────────────────────────

function DevisDetailModal({
  devis,
  onClose,
  onAction,
  onSign,
  isActing,
}: {
  devis: Devis;
  onClose: () => void;
  onAction: (id: string, statut: 'SELECTIONNE' | 'NON_RETENU') => void;
  onSign: (id: string) => void;
  isActing: boolean;
}) {
  const buildPdfProps = (dv: Devis): DevisPDFProps => {
    const ens = dv.demande?.enseignant;
    const sejour = dv.demande?.sejour;
    const htCalc = Number(dv.montantHT) || (dv.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
    const ttcCalc = Number(dv.montantTTC) || Number(dv.montantTotal) || 0;
    const tvaCalc = Number(dv.montantTVA) || (ttcCalc - htCalc);
    return {
      typeDocument: dv.typeDocument === 'FACTURE_ACOMPTE' ? 'FACTURE_ACOMPTE'
        : dv.typeDocument === 'FACTURE_SOLDE' ? 'FACTURE_SOLDE' : 'DEVIS',
      numeroDocument: dv.numeroDevis ?? dv.numeroFacture ?? `DEV-${dv.id.substring(0, 8).toUpperCase()}`,
      dateDocument: dv.createdAt,
      dateValidite: new Date(new Date(dv.createdAt).getTime() + 30 * 86400000).toISOString(),
      nomEmetteur: dv.nomEntreprise ?? dv.centre?.nom ?? '',
      adresseEmetteur: dv.adresseEntreprise ?? [dv.centre?.adresse, dv.centre?.codePostal, dv.centre?.ville].filter(Boolean).join(', '),
      siretEmetteur: dv.siretEntreprise ?? dv.centre?.siret ?? undefined,
      emailEmetteur: dv.emailEntreprise ?? dv.centre?.email ?? undefined,
      telEmetteur: dv.telEntreprise ?? dv.centre?.telephone ?? undefined,
      nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
      etablissementNom: ens?.etablissementNom ?? undefined,
      adresseDestinataire: ens?.etablissementAdresse ?? undefined,
      emailDestinataire: ens?.email ?? undefined,
      telDestinataire: ens?.telephone ?? undefined,
      titreSejour: sejour?.titre ?? dv.demande?.titre ?? '',
      lieuSejour: dv.demande?.villeHebergement,
      dateDebutSejour: sejour?.dateDebut ?? undefined,
      dateFinSejour: sejour?.dateFin ?? undefined,
      nombreEleves: dv.demande?.nombreEleves,
      niveauClasse: sejour?.niveauClasse ?? undefined,
      lignes: (dv.lignes ?? []).map(l => ({
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        tva: l.tva,
        totalHT: l.totalHT,
        totalTTC: l.totalTTC,
      })),
      montantHT: htCalc,
      montantTVA: tvaCalc,
      montantTTC: ttcCalc,
      montantAcompte: dv.montantAcompte != null ? Number(dv.montantAcompte) : undefined,
      pourcentageAcompte: dv.pourcentageAcompte ?? undefined,
      conditionsAnnulation: dv.conditionsAnnulation ?? dv.centre?.conditionsAnnulation ?? undefined,
      signatureDirecteur: dv.signatureDirecteur ?? undefined,
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-gray-900 truncate">Devis — {devis.centre?.nom ?? 'Centre'}</h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {devis.typeDevis === 'PDF' ? 'PDF' : 'Plateforme'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Séjour : {devis.demande?.sejour?.titre ?? devis.demande?.titre ?? '—'}
              {devis.demande?.enseignant && ` — ${devis.demande.enseignant.prenom} ${devis.demande.enseignant.nom}`}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">

          {/* Infos hébergeur */}
          <SectionLabel>Hébergeur</SectionLabel>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
            <div><span className="text-gray-500">Centre</span><p className="font-medium">{devis.centre?.nom ?? '—'}</p></div>
            <div><span className="text-gray-500">Ville</span><p className="font-medium">{devis.centre?.ville ?? '—'}</p></div>
            {devis.centre?.email && <div><span className="text-gray-500">Email</span><p className="font-medium">{devis.centre.email}</p></div>}
            {devis.centre?.telephone && <div><span className="text-gray-500">Téléphone</span><p className="font-medium">{devis.centre.telephone}</p></div>}
            {devis.nomEntreprise && <div><span className="text-gray-500">Entreprise</span><p className="font-medium">{devis.nomEntreprise}</p></div>}
            {devis.siretEntreprise && <div><span className="text-gray-500">SIRET</span><p className="font-medium">{devis.siretEntreprise}</p></div>}
          </div>

          <div className="flex justify-center py-6">
            <DevisPDFButton
              data={buildPdfProps(devis)}
              filename={`devis-${(devis.numeroDevis ?? devis.id).substring(0, 8)}.pdf`}
              label="Visualiser le devis complet"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onAction(devis.id, 'NON_RETENU')}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            Refuser
          </button>
          <button
            type="button"
            onClick={() => onSign(devis.id)}
            disabled={isActing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {isActing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : null}
            Signer électroniquement
          </button>
          <button onClick={onClose} className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Carte séjour ────────────────────────────────────────────────────────────

function SejourCard({
  sejour,
  onClick,
  dossierPret,
}: {
  sejour: SejourDirecteur;
  onClick: () => void;
  dossierPret?: boolean;
}) {
  const dateDebut = new Date(sejour.dateDebut).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const dateFin = new Date(sejour.dateFin).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const enseignant = sejour.createur
    ? `${sejour.createur.prenom} ${sejour.createur.nom}`
    : '—';

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:border-[var(--color-border-strong)] hover:shadow-md transition-all"
      onClick={onClick}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-900">{sejour.titre}</h3>
            <StatutBadge statut={sejour.statut} />
            {dossierPret && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Dossier complet
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {enseignant}
            </span>
            <span>{sejour.lieu}</span>
            <span>{dateDebut} → {dateFin}</span>
            <span>{sejour.placesTotales} élève{sejour.placesTotales > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div className="shrink-0 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </div>
      </div>
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
  const [filtre, setFiltre]       = useState<StatutSejour | 'ALL'>('APPROVED');
  const [devisAValider, setDevisAValider] = useState<Devis[]>([]);
  const [devisActingId, setDevisActingId] = useState<string | null>(null);

  // Factures
  const [factures, setFactures] = useState<Devis[]>([]);
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

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await updateSejourStatus(id, 'APPROVED');
      await loadSejours();
      // Refresh detail modal if open
      if (sejourDetail?.id === id) {
        const updated = await getSejourDetail(id);
        setSejourDetail(updated);
      }
    } catch {
      // no-op
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string, _motif: string) => {
    setActingId(id);
    try {
      await updateSejourStatus(id, 'REJECTED');
      await loadSejours();
      if (sejourDetail?.id === id) {
        const updated = await getSejourDetail(id);
        setSejourDetail(updated);
      }
    } catch {
      // no-op
    } finally {
      setActingId(null);
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
      await Promise.all([loadDevis(), loadSejours(), loadFactures()]);
      setDevisDetail(null);
    } catch { /* ignore */ }
    setDevisActingId(null);
  };

  const handleSignerDevis = async (devisId: string) => {
    setDevisActingId(devisId);
    try {
      await signerDevis(devisId);
      await Promise.all([loadDevis(), loadSejours()]);
      setDevisDetail(null);
    } catch { /* ignore */ }
    setDevisActingId(null);
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
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

      {/* Modals */}
      {rectoratSuccess && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-purple-600 text-white px-5 py-3 text-sm font-semibold shadow-lg animate-in fade-in">
          {rectoratSuccess}
        </div>
      )}
      {chorusXml && <ChorusModal xml={chorusXml} onClose={() => setChorusXml(null)} />}
      {sejourDetail && (
        <SejourDetailModal
          detail={sejourDetail}
          onClose={() => setSejourDetail(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          onSoumettreRectorat={handleSoumettreRectorat}
          emailRectoratConfigured={!!emailRectoratSaved}
          isActing={actingId === sejourDetail.id}
        />
      )}
      {devisDetail && (
        <DevisDetailModal
          devis={devisDetail}
          onClose={() => setDevisDetail(null)}
          onAction={handleDevisAction}
          onSign={handleSignerDevis}
          isActing={devisActingId === devisDetail.id}
        />
      )}

      {/* Loading overlay for detail fetch */}
      {sejourDetailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" showTagline={false} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                  <span className="text-xs font-semibold text-[var(--color-primary)]">{initials}</span>
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">Direction</p>
                </div>
              </div>
              <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Se déconnecter</button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Validation des séjours</h1>
          <p className="mt-1 text-sm text-gray-500">Approuvez ou refusez les séjours soumis par les enseignants</p>
        </div>

        {/* Filtres / compteurs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            ['ALL',              'Tous',            sejours.length,                      'bg-gray-100 text-gray-700 ring-gray-300'],
            ['REJECTED',         'Refusés',         countByStatut('REJECTED'),           'bg-red-50 text-red-700 ring-red-300'],
            ['CONVENTION',       'Convention',      countByStatut('CONVENTION'),         'bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-[var(--color-border-strong)]'],
            ['SIGNE_DIRECTION',  'Signé direction', countByStatut('SIGNE_DIRECTION'),    'bg-purple-50 text-purple-700 ring-purple-300'],
            ['SOUMIS_RECTORAT',  'Rectorat',        countByStatut('SOUMIS_RECTORAT'),    'bg-purple-50 text-purple-700 ring-purple-300'],
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

        {/* Liste séjours */}
        {sejoursFiltres.length > 0 ? (
          <div className="space-y-3">
            {sejoursFiltres.map((s) => (
              <SejourCard
                key={s.id}
                sejour={s}
                onClick={() => handleOpenSejourDetail(s.id)}
                dossierPret={
                  s.statut === 'CONVENTION' &&
                  (s._count?.autorisations ?? 0) > 0 &&
                  (s._count?.planningActivites ?? 0) > 0
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-primary-light)]">
              <svg className="h-7 w-7 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">Aucun séjour à afficher</h2>
            <p className="mt-1 text-sm text-gray-500">
              {filtre === 'SUBMITTED'
                ? 'Aucun séjour en attente de validation.'
                : 'Aucun séjour dans cette catégorie.'}
            </p>
          </div>
        )}

        {/* ── Devis à signer ─────────────────────────────────────────── */}
        {devisAValider.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Devis à signer
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                {devisAValider.length}
              </span>
            </h2>
            <div className="space-y-3">
              {devisAValider.map((dv) => (
                <div
                  key={dv.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all"
                  onClick={() => setDevisDetail(dv)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{dv.centre?.nom ?? 'Centre'}</h3>
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {dv.typeDevis === 'PDF' ? 'PDF' : 'Plateforme'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Séjour : {dv.demande?.sejour?.titre ?? dv.demande?.titre ?? '—'}</span>
                        {dv.demande?.enseignant && <span>Enseignant : {dv.demande.enseignant.prenom} {dv.demande.enseignant.nom}</span>}
                        <span>{dv.centre?.ville ?? '—'}</span>
                        <span>Total : {dv.montantTotal} €</span>
                        <span>Par élève : {dv.montantParEleve} €</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-gray-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                          {f.demande?.sejour?.titre ?? f.demande?.titre ?? 'Séjour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          {f.numeroFacture}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Hébergeur : {f.centre?.nom ?? '—'}</span>
                        <span>
                          Montant acompte :{' '}
                          <span className="font-bold text-amber-700">{fmt(Number(f.montantAcompte ?? 0))} €</span>
                        </span>
                        <span>Total TTC : {fmt(Number(f.montantTTC ?? f.montantTotal))} €</span>
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
                          {f.demande?.sejour?.titre ?? f.demande?.titre ?? 'Séjour'}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-success)]">
                          Acompte versé — {f.numeroFacture}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>Hébergeur : {f.centre?.nom ?? '—'}</span>
                        <span>Montant : {fmt(Number(f.montantAcompte ?? 0))} €</span>
                        {f.dateVersementAcompte && (
                          <span>Versé le : {new Date(f.dateVersementAcompte).toLocaleDateString('fr-FR')}</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Email DSDEN / Rectorat</label>
              <p className="text-xs text-gray-500 mb-2">Cet email sera utilisé automatiquement pour envoyer le dossier lors de la soumission au rectorat</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailRectorat}
                  onChange={(e) => setEmailRectorat(e.target.value)}
                  placeholder="dsden@ac-academie.fr"
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
