'use client';

import type { RoomingData } from '@/src/lib/collaboration';
import { ETIQUETTES, groupByEtage } from '@/src/lib/rooming';

// Vue plan du rooming — « qui dort où », lecture seule (aucun drag, aucun
// bouton d'action, aucun appel API). Réutilisée côté organisateur (toggle de
// TabRooming) et à terme côté hébergeur / PDF D13.

export interface RoomingPlanViewProps {
  rooming: RoomingData;
}

export default function RoomingPlanView({ rooming }: RoomingPlanViewProps) {
  const groupes = groupByEtage(rooming.chambres);
  const { eleves, encadrants } = rooming.nonAffectes;

  return (
    <div className="space-y-6">
      {groupes.map((g, i) => (
        <div key={g.etage ?? `sans-etage-${i}`}>
          {/* Étage null : pas d'en-tête si c'est le seul groupe (plan à plat),
              « Autres » dans le cas mixte. */}
          {(g.etage !== null || groupes.length > 1) && (
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {g.etage ?? 'Autres'}
            </h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {g.chambres.map((c) => {
              const et = ETIQUETTES.find((e) => e.label === c.etiquette);
              return (
                <div key={c.occupationId} className="rounded-2xl border-2 border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">{c.nom}</span>
                      {c.etiquette && (
                        <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${et?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.etiquette}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">({c.occupants.length}/{c.capacite})</span>
                  </div>
                  {c.occupants.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-2">Aucun participant réparti</p>
                  ) : (
                    <div className="space-y-1">
                      {c.occupants.map((o) => (
                        <div key={o.affectationId} className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-900">
                          {o.prenom} {o.nom}
                          {o.type === 'ENCADRANT' && (
                            <span className="ml-1 text-[10px] text-violet-600">encadrant</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Non affectés — lecture seule, blocs masqués si vides */}
      {(eleves.length > 0 || encadrants.length > 0) && (
        <div className="space-y-4 pt-2 border-t border-gray-100">
          {eleves.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Élèves non affectés ({eleves.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {eleves.map((p) => (
                  <span key={p.id} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-900">
                    {p.prenom} {p.nom}
                  </span>
                ))}
              </div>
            </div>
          )}
          {encadrants.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Encadrants non affectés ({encadrants.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {encadrants.map((p) => (
                  <span key={p.id} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-900">
                    {p.prenom} {p.nom}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
