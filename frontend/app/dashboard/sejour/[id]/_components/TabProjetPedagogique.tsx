'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDossierPedagogique } from '@/src/lib/sejour';
import type { DossierPedagogiqueData } from '@/src/lib/sejour';
import ProjetPedagogiquePDFButton from '@/src/components/pdf/ProjetPedagogiquePDFButton';
import PreparationTamPDFButton from '@/src/components/pdf/PreparationTamPDFButton';
import { formatDate } from '@/src/lib/utils';

export interface TabProjetPedagogiqueProps {
  sejourId: string;
}

export default function TabProjetPedagogique({ sejourId }: TabProjetPedagogiqueProps) {
  const [dossier, setDossier] = useState<DossierPedagogiqueData | null>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [objectifsPedago, setObjectifsPedago] = useState('');
  const [lienProgrammes, setLienProgrammes] = useState('');

  const loadDossier = useCallback(async () => {
    if (!sejourId) return;
    setDossierLoading(true);
    try {
      const data = await getDossierPedagogique(sejourId);
      setDossier(data);
      if (!lienProgrammes && data.thematiquesPedagogiques?.length > 0) {
        setLienProgrammes(data.thematiquesPedagogiques.join(', '));
      }
    } catch { /* ignore */ }
    finally { setDossierLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sejourId]);

  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  return (
    <div className="space-y-6">
      <style>{`@media print { [data-print-hide] { display: none !important; } [data-print-show] { display: block !important; } }`}</style>

      {dossierLoading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        </div>
      )}

      {!dossierLoading && dossier && (() => {
        const d = dossier;
        const signedAuto = d.autorisations.filter((a) => a.signeeAt).length;
        const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

        const planByDay = d.planningActivites.reduce<Record<string, typeof d.planningActivites>>((acc, p) => {
          const day = p.date.slice(0, 10);
          (acc[day] ??= []).push(p);
          return acc;
        }, {});

        return (
          <>
            {/* Boutons PDF */}
            <div className="flex justify-end gap-2 flex-wrap" data-print-hide>
              <ProjetPedagogiquePDFButton
                data={d}
                objectifsPedago={objectifsPedago}
                lienProgrammes={lienProgrammes}
                filename={`projet-pedagogique-${d.titre?.toLowerCase().replace(/\s+/g, '-') ?? 'sejour'}.pdf`}
              />
              {d.typeContexte === 'HORS_SCOLAIRE' && (
                <PreparationTamPDFButton data={d} sejourId={sejourId} />
              )}
            </div>

            {/* En-tête impression */}
            <div className="hidden print:block text-center mb-8" data-print-show style={{ display: 'none' }}>
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Projet pédagogique</h1>
              <p className="text-lg text-gray-700 mt-1">{d.titre}</p>
              <p className="text-xs text-gray-400 mt-2">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
            </div>

            {/* Section 2 — Établissement */}
            <div id="projet-print-content" className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Établissement scolaire</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Établissement</span>
                  <p className="font-medium text-gray-900">{d.createur?.memberships?.[0]?.organisation.nom ?? '—'}</p>
                  {d.createur?.memberships?.[0]?.organisation.uai && <p className="text-xs text-gray-400">UAI : {d.createur.memberships[0].organisation.uai}</p>}
                  {d.createur?.memberships?.[0]?.organisation.ville && <p className="text-xs text-gray-500">{d.createur.memberships[0].organisation.ville}</p>}
                </div>
                <div>
                  <span className="text-gray-500">Enseignant responsable</span>
                  <p className="font-medium text-gray-900">{d.createur?.prenom} {d.createur?.nom}</p>
                  {d.createur?.email && <p className="text-xs text-gray-500">{d.createur.email}</p>}
                  {d.createur?.telephone && <p className="text-xs text-gray-500">{d.createur.telephone}</p>}
                </div>
              </div>
            </div>

            {/* Section 3 — Informations séjour */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Informations du séjour</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Dates</span>
                  <p className="font-medium text-gray-900">Du {formatDate(d.dateDebut, 'long')} au {formatDate(d.dateFin, 'long')}</p>
                </div>
                <div>
                  <span className="text-gray-500">Destination</span>
                  <p className="font-medium text-gray-900">{d.lieu}</p>
                </div>
                <div>
                  <span className="text-gray-500">Nombre d&apos;élèves</span>
                  <p className="font-medium text-gray-900">{d.placesTotales}</p>
                </div>
                <div>
                  <span className="text-gray-500">Niveau de classe</span>
                  <p className="font-medium text-gray-900">{d.niveauClasse ?? '—'}</p>
                </div>
                {d.hebergementSelectionne && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Hébergement</p>
                    <div className="flex items-start gap-3">
                      {d.hebergementSelectionne?.imageUrl && (
                        <img
                          src={d.hebergementSelectionne.imageUrl}
                          alt={d.hebergementSelectionne.nom}
                          className="w-16 h-16 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{d.hebergementSelectionne.nom}</p>
                        <p className="text-xs text-gray-500">{d.hebergementSelectionne.adresse}, {d.hebergementSelectionne.ville}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {d.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">Informations complémentaires</span>
                  <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{d.description}</p>
                </div>
              )}
            </div>

            {/* Section 4 — Objectifs pédagogiques */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Objectifs pédagogiques du séjour</h3>
              <textarea
                value={objectifsPedago}
                onChange={(e) => setObjectifsPedago(e.target.value)}
                rows={4}
                placeholder="Décrivez les objectifs pédagogiques de ce séjour..."
                className={inputCls}
                data-print-hide
              />
              {objectifsPedago && (
                <div className="hidden print:block text-sm text-gray-900 whitespace-pre-wrap" data-print-show style={{ display: 'none' }}>
                  {objectifsPedago}
                </div>
              )}
            </div>

            {/* Section 5 — Lien avec les programmes */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Lien avec les programmes scolaires</h3>
              <textarea
                value={lienProgrammes}
                onChange={(e) => setLienProgrammes(e.target.value)}
                rows={3}
                placeholder="Expliquez le lien entre ce séjour et les programmes scolaires..."
                className={inputCls}
                data-print-hide
              />
              {lienProgrammes && (
                <div className="hidden print:block text-sm text-gray-900 whitespace-pre-wrap" data-print-show style={{ display: 'none' }}>
                  {lienProgrammes}
                </div>
              )}
            </div>

            {/* Section 5b — Budget prévisionnel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 print:shadow-none print:border-gray-300">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Budget prévisionnel</h3>

              {/* Prestations hébergeur */}
              {d.demandes?.[0]?.devis?.[0]?.lignes?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prestations hébergeur</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1 text-xs font-medium text-gray-600">Description</th>
                        <th className="text-right py-1 text-xs font-medium text-gray-600">Qté</th>
                        <th className="text-right py-1 text-xs font-medium text-gray-600">PU HT</th>
                        <th className="text-right py-1 text-xs font-medium text-gray-600">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.demandes[0].devis[0].lignes.map((l, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 text-gray-700">{l.description}</td>
                          <td className="py-1 text-right text-gray-600">{l.quantite}</td>
                          <td className="py-1 text-right text-gray-600">{l.prixUnitaire.toFixed(2)} €</td>
                          <td className="py-1 text-right font-medium text-gray-900">{l.totalTTC.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Dépenses complémentaires */}
              {d.lignesBudget?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dépenses complémentaires</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {d.lignesBudget.map((l) => (
                        <tr key={l.id} className="border-b border-gray-50">
                          <td className="py-1 text-gray-600">{l.categorie}</td>
                          <td className="py-1 text-gray-700">{l.description}</td>
                          <td className="py-1 text-right font-medium text-gray-900">{l.montant.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Recettes */}
              {d.recettesBudget?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recettes</p>
                  <table className="w-full text-sm">
                    <tbody>
                      {d.recettesBudget.map((r) => (
                        <tr key={r.id} className="border-b border-gray-50">
                          <td className="py-1 text-gray-600">{r.source}</td>
                          <td className="py-1 text-right font-medium text-gray-900">{r.montant.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!d.demandes?.[0]?.devis?.[0]?.lignes?.length && !d.lignesBudget?.length && !d.recettesBudget?.length && (
                <p className="text-sm text-gray-400 text-center py-4">Aucune donnée budgétaire renseignée.</p>
              )}
            </div>

            {/* Section 6 — Encadrement */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Encadrement ({d.accompagnateurs.length} accompagnateur{d.accompagnateurs.length > 1 ? 's' : ''})</h3>
              {d.accompagnateurs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun accompagnateur enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Nom</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Email</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Transport</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Ordre de mission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.accompagnateurs.map((a) => (
                        <tr key={a.id} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-gray-900">{a.prenom} {a.nom}</td>
                          <td className="py-2 px-3 text-gray-600">{a.email}</td>
                          <td className="py-2 px-3 text-gray-600">{a.moyenTransport ?? '—'}</td>
                          <td className="py-2 px-3 text-center">
                            {a.signeeAt ? (
                              <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Signé</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">En attente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section 7 — Élèves participants */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Élèves participants</h3>
              <p className="text-sm text-gray-500 mb-4">{signedAuto}/{d.autorisations.length} autorisations signées</p>
              {d.autorisations.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun élève enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Nom</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-700">Prénom</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-700">Autorisation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.autorisations.map((a, i) => (
                        <tr key={i} className={`border-b border-gray-100 ${i >= 20 ? 'hidden print:table-row' : ''}`}>
                          <td className="py-2 px-3 text-gray-900">{a.eleveNom}</td>
                          <td className="py-2 px-3 text-gray-900">{a.elevePrenom}</td>
                          <td className="py-2 px-3 text-center">
                            {a.signeeAt ? (
                              <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium">Signée</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-xs font-medium">En attente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {d.autorisations.length > 20 && (
                    <p className="mt-2 text-xs text-gray-400 text-center print:hidden" data-print-hide>
                      {d.autorisations.length - 20} élève{d.autorisations.length - 20 > 1 ? 's' : ''} supplémentaire{d.autorisations.length - 20 > 1 ? 's' : ''} (visible{d.autorisations.length - 20 > 1 ? 's' : ''} à l&apos;impression)
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section 8 — Programme prévisionnel */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Programme prévisionnel</h3>
              {d.planningActivites.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Planning non encore renseigné.</p>
              ) : (
                <div>
                  {Object.entries(planByDay)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([day, items]) => (
                      <div key={day} className="mb-4">
                        <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide mb-1.5">
                          {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-[var(--color-primary)] text-white">
                              <th className="text-left px-3 py-1.5 text-xs font-medium w-32">Horaire</th>
                              <th className="text-left px-3 py-1.5 text-xs font-medium">Activité</th>
                              <th className="text-left px-3 py-1.5 text-xs font-medium w-32">Responsable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(items as typeof d.planningActivites).map((p, i) => (
                              <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-1.5 text-xs font-mono text-gray-600 border-b border-gray-100">
                                  {p.heureDebut} – {p.heureFin}
                                </td>
                                <td className="px-3 py-1.5 text-sm text-gray-900 border-b border-gray-100 font-medium">
                                  {p.titre}
                                  {p.description && <span className="block text-xs text-gray-500 font-normal">{p.description}</span>}
                                </td>
                                <td className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
                                  {p.responsable ?? '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Section 9 — Hébergement */}
            {d.hebergementSelectionne && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Centre d&apos;hébergement</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nom</span>
                    <p className="font-medium text-gray-900">{d.hebergementSelectionne.nom}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Adresse</span>
                    <p className="font-medium text-gray-900">{d.hebergementSelectionne.adresse}, {d.hebergementSelectionne.ville}</p>
                  </div>
                  {d.hebergementSelectionne.telephone && (
                    <div>
                      <span className="text-gray-500">Téléphone</span>
                      <p className="font-medium text-gray-900">{d.hebergementSelectionne.telephone}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
