'use client';

import { useEffect, useState } from 'react';
import {
  addLigneCompl,
  deleteLigneCompl,
  addRecetteBudget,
  deleteRecetteBudget,
} from '@/src/lib/collaboration';
import type { BudgetData, LigneCompl, RecetteBudget } from '@/src/lib/collaboration';
import type { User } from '@/src/types/auth';
import BudgetPDFButton from '@/src/components/pdf/BudgetPDFButton';
import { formatDate } from '@/src/lib/utils';

const CATEGORIES_COMPL =['Transport', 'Assurance', 'Visites et activités', 'Restauration hors forfait', 'Autre'];
const SOURCES_RECETTES = ['Participation familles', 'Subvention collectivité', 'FSE / MDL', 'Ressources établissement', 'Don association', 'Autre'];

export interface TabBudgetProps {
  sejourId: string;
  user: User;
  budgetData: BudgetData | null;
  budgetLoading: boolean;
  /** Recharge budgetData côté page (utilisé en récupération d'erreur). */
  onReload: () => void;
  /** ⚠️ Branché sur setError côté page (écran d'erreur) — comportement historique préservé. */
  onError: (message: string) => void;
}

export default function TabBudget({ sejourId, user, budgetData, budgetLoading, onReload, onError }: TabBudgetProps) {
  // Copies éditables, synchronisées depuis budgetData (chargé par la page — state partagé
  // avec l'onglet devis).
  const [lignesCompl, setLignesCompl] = useState<LigneCompl[]>([]);
  const [ligneComplForm, setLigneComplForm] = useState({ categorie: 'Transport', description: '', montant: '' });
  const [recettes, setRecettes] = useState<RecetteBudget[]>([]);
  const [recetteForm, setRecetteForm] = useState({ source: 'Participation familles', montant: '' });

  useEffect(() => {
    if (budgetData?.lignesCompl) setLignesCompl(budgetData.lignesCompl);
    if (budgetData?.recettes) setRecettes(budgetData.recettes);
  }, [budgetData]);

  return (
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

        const handleAddLigneCompl = async () => {
          const montant = parseFloat(ligneComplForm.montant);
          if (!ligneComplForm.description.trim() || isNaN(montant) || montant <= 0 || !sejourId) return;
          try {
            const newLigne = await addLigneCompl(sejourId, { categorie: ligneComplForm.categorie, description: ligneComplForm.description.trim(), montant });
            setLignesCompl((prev) => [...prev, newLigne]);
            setLigneComplForm({ categorie: 'Transport', description: '', montant: '' });
          } catch { /* ignore */ }
        };

        const handleAddRecette = async () => {
          const montant = parseFloat(recetteForm.montant);
          if (isNaN(montant) || montant <= 0 || !sejourId) return;
          try {
            const newRecette = await addRecetteBudget(sejourId, { source: recetteForm.source, montant });
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
                      Du {formatDate(s.dateDebut, 'long', 'Dates à définir')} au {formatDate(s.dateFin, 'long', 'Dates à définir')} — {s.placesTotales} élèves
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
                              <button onClick={async () => { if (!sejourId) return; try { await deleteLigneCompl(sejourId, l.id); setLignesCompl((prev) => prev.filter((x) => x.id !== l.id)); } catch (err) { console.error('[deleteLigneCompl]', err); onError('Une erreur est survenue. Veuillez réessayer.'); onReload(); } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
                              <button onClick={async () => { if (!sejourId) return; try { await deleteRecetteBudget(sejourId, r.id); setRecettes((prev) => prev.filter((x) => x.id !== r.id)); } catch (err) { console.error('[deleteRecetteBudget]', err); onError('Une erreur est survenue. Veuillez réessayer.'); onReload(); } }} className="print:hidden text-red-400 hover:text-red-600 text-xs">Suppr.</button>
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
  );
}
