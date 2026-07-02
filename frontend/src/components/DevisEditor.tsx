'use client';

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type { ProduitCatalogue } from '@/src/lib/centre';
import type { UseDevisLignes } from '@/src/hooks/useDevisLignes';
import { round2, formatMontant } from '@/src/lib/devis-calculs';
import CatalogueSuggestionInput from '@/src/components/CatalogueSuggestionInput';

/**
 * Éditeur de devis partagé entre la création (devis/nouveau) et la
 * modification (devis/[id]/modifier). Rend le « document » devis :
 * en-tête émetteur, lignes (grille 12 colonnes + insertion entre lignes),
 * totaux (slider acompte 10-50 %), conditions et barre d'actions.
 *
 * Les sections spécifiques à chaque page sont injectées en slots :
 * - `destinataire` / `objet` : blocs propres à chaque flux (COLLAB/DIRECT/édition)
 * - `catalogueActions` : UI catalogue propre à la page (panneau ou recherche)
 * - `totauxExtra` : contenu additionnel sous le panneau des totaux (ex: alerte acompte)
 */
export interface DevisEditorProps {
  // Émetteur (inputs contrôlés par la page)
  nomEntreprise: string;
  onNomEntrepriseChange: (v: string) => void;
  adresseEntreprise: string;
  onAdresseEntrepriseChange: (v: string) => void;
  siretEntreprise: string;
  onSiretEntrepriseChange: (v: string) => void;
  emailEntreprise: string;
  onEmailEntrepriseChange: (v: string) => void;
  telEntreprise: string;
  onTelEntrepriseChange: (v: string) => void;
  // En-tête droite
  numeroDevis: string;
  dateDevis: string;
  dateValidite: string;
  validiteJours: number;
  // Slots spécifiques à la page
  destinataire: ReactNode;
  objet: ReactNode;
  catalogueActions?: ReactNode;
  totauxExtra?: ReactNode;
  // Lignes + totaux (hook partagé)
  devisLignes: UseDevisLignes;
  catalogue: ProduitCatalogue[];
  // Conditions
  conditionsAnnulation: string;
  onConditionsAnnulationChange: (v: string) => void;
  // Actions
  cancelHref: string;
  submitLabel: string;
  submitLoadingLabel: string;
  submitIcon: ReactNode;
  onSubmit: () => void;
  sending: boolean;
}

export default function DevisEditor({
  nomEntreprise, onNomEntrepriseChange,
  adresseEntreprise, onAdresseEntrepriseChange,
  siretEntreprise, onSiretEntrepriseChange,
  emailEntreprise, onEmailEntrepriseChange,
  telEntreprise, onTelEntrepriseChange,
  numeroDevis, dateDevis, dateValidite, validiteJours,
  destinataire, objet, catalogueActions, totauxExtra,
  devisLignes, catalogue,
  conditionsAnnulation, onConditionsAnnulationChange,
  cancelHref, submitLabel, submitLoadingLabel, submitIcon, onSubmit, sending,
}: DevisEditorProps) {
  const {
    lignes, updateLigne, addLigne, removeLigne, insertLigneAt, selectProduitForLigne,
    calculs, pourcentageAcompte, setPourcentageAcompte,
  } = devisLignes;

  const fmt = formatMontant;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

      {/* ── Section 1 : En-tête ───────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between gap-6">
          <div className="flex-1 space-y-3">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Émetteur</h2>
            <input value={nomEntreprise} onChange={(e) => onNomEntrepriseChange(e.target.value)}
              placeholder="Nom de l'entreprise" className="w-full text-lg font-bold text-gray-900 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
            <textarea value={adresseEntreprise} onChange={(e) => onAdresseEntrepriseChange(e.target.value)}
              placeholder="Adresse complète" rows={2} className="w-full text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1 resize-none" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input value={siretEntreprise} onChange={(e) => onSiretEntrepriseChange(e.target.value)}
                placeholder="SIRET" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
              <input value={emailEntreprise} onChange={(e) => onEmailEntrepriseChange(e.target.value)}
                placeholder="Email" type="email" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
              <input value={telEntreprise} onChange={(e) => onTelEntrepriseChange(e.target.value)}
                placeholder="Téléphone" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
            </div>
          </div>
          <div className="sm:text-right space-y-2 shrink-0">
            <h1 className="text-2xl font-extrabold text-[var(--color-primary)]">DEVIS</h1>
            <p className="text-sm text-gray-500">N° <span className="font-mono font-semibold text-gray-900">{numeroDevis}</span></p>
            <p className="text-sm text-gray-500">Date : {dateDevis}</p>
            <p className="text-sm text-gray-500">Valide jusqu&apos;au : {dateValidite}</p>
          </div>
        </div>
      </div>

      {/* ── Section 2 : Destinataire (slot page) ──────────────────────── */}
      <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Destinataire</h2>
        {destinataire}
      </div>

      {/* ── Section 3 : Objet (slot page) ─────────────────────────────── */}
      <div className="px-8 py-6 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Objet</h2>
        {objet}
      </div>

      {/* ── Section 4 : Lignes de devis ───────────────────────────────── */}
      <div className="px-8 py-6 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Détail de la prestation</h2>

        {/* Header */}
        <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 border-b border-gray-200 mb-2">
          <div className="col-span-3">Description</div>
          <div className="col-span-2 text-right">Quantité</div>
          <div className="col-span-2 text-right">PU TTC</div>
          <div className="col-span-1 text-right">TVA %</div>
          <div className="col-span-1 text-right">PU HT</div>
          <div className="col-span-2 text-right">Total TTC</div>
          <div className="col-span-1" />
        </div>

        {/* Lines */}
        {lignes.map((l, idx) => {
          const qte = parseFloat(l.quantite) || 0;
          const puTTC = parseFloat(l.prixUnitaire) || 0;
          const tvaRate = parseFloat(l.tva) || 0;
          const puHT = round2(puTTC / (1 + tvaRate / 100));
          const totalTTC = round2(puTTC * qte);
          return (
            <Fragment key={l.key}>
            <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-50 group">
              <div className="col-span-12 sm:col-span-3">
                <CatalogueSuggestionInput
                  value={l.description}
                  onChange={(v) => updateLigne(l.key, 'description', v)}
                  catalogue={catalogue}
                  onSelect={(p) => selectProduitForLigne(l.key, p)}
                  placeholder="Description"
                  className="w-full text-sm border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent"
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input value={l.quantite} onChange={(e) => updateLigne(l.key, 'quantite', e.target.value)}
                  placeholder="0" type="number" step="any" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <input value={l.prixUnitaire} onChange={(e) => updateLigne(l.key, 'prixUnitaire', e.target.value)}
                  placeholder="0.00" type="number" step="0.01" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <input value={l.tva} onChange={(e) => updateLigne(l.key, 'tva', e.target.value)}
                  placeholder="0" type="number" step="0.1" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
              </div>
              <div className="col-span-1 sm:col-span-1 text-right text-sm text-gray-500">
                {puHT > 0 ? fmt(puHT) : '—'} €
              </div>
              <div className="col-span-1 sm:col-span-2 text-right text-sm font-medium text-gray-900">
                {fmt(totalTTC)} €
              </div>
              <div className="col-span-1 text-right">
                {lignes.length > 1 && (
                  <button onClick={() => removeLigne(l.key)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Bouton d'insertion entre les lignes — uniquement entre 2 lignes, pas après la dernière */}
            {idx < lignes.length - 1 && (
              <div className="group/ins relative flex items-center justify-center h-0 overflow-visible">
                <button
                  type="button"
                  onClick={() => insertLigneAt(idx)}
                  className="absolute opacity-0 group-hover/ins:opacity-100 transition-opacity z-10 flex items-center gap-1 rounded-full bg-[var(--color-primary)] text-white px-2.5 py-0.5 text-[10px] font-semibold shadow hover:scale-105 transition-transform whitespace-nowrap"
                  title="Insérer une ligne à cet endroit"
                >
                  + insérer ici
                </button>
                {/* Ligne de séparation visible au survol */}
                <div className="absolute inset-x-0 h-px bg-[var(--color-primary)] opacity-0 group-hover/ins:opacity-30 transition-opacity" />
              </div>
            )}
            </Fragment>
          );
        })}

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {/* UI catalogue spécifique à la page (panneau / recherche / liens) */}
          {catalogueActions}

          {/* Bouton ligne vide */}
          <button
            type="button"
            onClick={addLigne}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ligne libre
          </button>
        </div>
      </div>

      {/* ── Section 5 : Totaux ────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Acompte */}
          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Acompte demandé : {pourcentageAcompte}%
              </label>
              <input type="range" min="10" max="50" step="5" value={pourcentageAcompte}
                onChange={(e) => setPourcentageAcompte(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10%</span><span>50%</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="sm:w-72 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Sous-total HT</span>
              <span className="font-medium text-gray-900">{fmt(calculs.montantHT)} €</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">TVA</span>
              <span className="font-medium text-gray-900">{fmt(calculs.montantTVA)} €</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
              <span className="text-gray-900">Total TTC</span>
              <span className="text-[var(--color-primary)]">{fmt(calculs.montantTTC)} €</span>
            </div>
            <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Acompte ({pourcentageAcompte}%)</span>
                <span className="font-semibold text-orange-600">{fmt(calculs.montantAcompte)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Reste à payer</span>
                <span className="font-medium text-gray-700">{fmt(calculs.resteAPayer)} €</span>
              </div>
            </div>
            {totauxExtra}
          </div>
        </div>
      </div>

      {/* ── Section 6 : Conditions ────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conditions</h2>
        <textarea value={conditionsAnnulation} onChange={(e) => onConditionsAnnulationChange(e.target.value)}
          rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-border-strong)] bg-white" />
        <p className="mt-2 text-xs text-gray-400">Validité du devis : {validiteJours} jours (jusqu&apos;au {dateValidite})</p>
      </div>

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="px-8 py-6 flex flex-col sm:flex-row gap-3 justify-end">
        <Link
          href={cancelHref}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
        >
          Annuler
        </Link>
        <button onClick={onSubmit}
          disabled={sending || calculs.montantHT <= 0}
          className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {sending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {submitLoadingLabel}
            </>
          ) : (
            <>
              {submitIcon}
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
