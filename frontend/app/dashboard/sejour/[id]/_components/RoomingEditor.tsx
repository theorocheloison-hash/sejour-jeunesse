'use client';

import { useState } from 'react';
import type { RoomingChambre, RoomingData, RoomingParticipant } from '@/src/lib/collaboration';
import { ETIQUETTES, groupByEtage } from '@/src/lib/rooming';

// Éditeur drag & drop du rooming (extrait de TabRooming, 3b) — présentationnel :
// l'état drag vit ici, les écritures remontent via onAffecter/onRetirer.

// Pastille catégorie élève — palette alignée sur les étiquettes de chambre
// (Filles=teal, Garçons=amber ; AUTRE reprend le slate de « Mixte »).
const CATEGORIE_PASTILLE: Record<'FILLE' | 'GARCON' | 'AUTRE', { lettre: string; cls: string }> = {
  FILLE: { lettre: 'F', cls: ETIQUETTES.find((e) => e.label === 'Filles')?.cls ?? 'bg-teal-100 text-teal-700' },
  GARCON: { lettre: 'G', cls: ETIQUETTES.find((e) => e.label === 'Garçons')?.cls ?? 'bg-amber-100 text-amber-700' },
  AUTRE: { lettre: 'A', cls: ETIQUETTES.find((e) => e.label === 'Mixte')?.cls ?? 'bg-slate-100 text-slate-700' },
};

export interface RoomingEditorProps {
  rooming: RoomingData;
  onAffecter: (chambreId: string, body: { autorisationId?: string; accompagnateurId?: string }) => void;
  onRetirer: (affectationId: string) => void;
  /** Regroupement des chambres par étage (pattern RoomingPlanView) — défaut à plat. */
  groupParEtage?: boolean;
}

export default function RoomingEditor({ rooming, onAffecter, onRetirer, groupParEtage = false }: RoomingEditorProps) {
  // ⚠️ Pas un simple id : au drop il faut savoir poster autorisationId (ELEVE)
  // ou accompagnateurId (ENCADRANT).
  const [drag, setDrag] = useState<{ id: string; type: 'ELEVE' | 'ENCADRANT' } | null>(null);

  const eleves = rooming.nonAffectes.eleves;
  const encadrants = rooming.nonAffectes.encadrants;
  const chambres = rooming.chambres;

  const handleDrop = (chambreId: string) => {
    if (!drag) return;
    const body =
      drag.type === 'ELEVE' ? { autorisationId: drag.id } : { accompagnateurId: drag.id };
    setDrag(null);
    onAffecter(chambreId, body);
  };

  function renderChambre(c: RoomingChambre) {
    const et = ETIQUETTES.find((e) => e.label === c.etiquette);
    return (
                  <div
                    key={c.occupationId}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleDrop(c.chambreId); }}
                    className={`rounded-2xl border-2 bg-white p-4 transition-colors ${
                      drag ? 'border-dashed border-[var(--color-primary)] bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{c.nom}</span>
                        {c.etage && <span className="text-xs text-gray-400 shrink-0">{c.etage}</span>}
                        {c.etiquette && (
                          <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${et?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                            {c.etiquette}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">({c.occupants.length}/{c.capacite})</span>
                    </div>
                    <div className="space-y-1 min-h-8">
                      {c.occupants.map((o) => (
                        <div key={o.affectationId} className="flex items-center justify-between rounded-lg bg-gray-50 px-2 py-1 text-xs">
                          <span className="truncate text-gray-900">
                            {o.prenom} {o.nom}
                            {o.type === 'ENCADRANT' && (
                              <span className="ml-1 text-[10px] text-violet-600">encadrant</span>
                            )}
                          </span>
                          <button onClick={() => onRetirer(o.affectationId)}
                            className="shrink-0 ml-2 text-gray-300 hover:text-red-400">&times;</button>
                        </div>
                      ))}
                      {c.occupants.length === 0 && (
                        <p className="text-xs text-gray-300 text-center py-2">Glissez un participant ici</p>
                      )}
                    </div>
                  </div>
    );
  }

  function renderDraggable(p: RoomingParticipant, type: 'ELEVE' | 'ENCADRANT') {
    return (
      <div
        key={p.id}
        draggable
        onDragStart={() => setDrag({ id: p.id, type })}
        onDragEnd={() => setDrag(null)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs cursor-grab active:cursor-grabbing"
      >
        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-semibold shrink-0">
          {p.prenom?.[0] ?? ''}{p.nom?.[0] ?? ''}
        </div>
        <span className="truncate font-medium text-gray-900">{p.prenom} {p.nom}</span>
        {/* Catégorie : élèves seulement (les encadrants n'en ont pas — V1) */}
        {type === 'ELEVE' && p.hebergementCategorie && (
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
              CATEGORIE_PASTILLE[p.hebergementCategorie].cls
            }`}
            title={p.hebergementCategorie === 'FILLE' ? 'Fille' : p.hebergementCategorie === 'GARCON' ? 'Garçon' : 'Autre'}
          >
            {CATEGORIE_PASTILLE[p.hebergementCategorie].lettre}
          </span>
        )}
        {p.signee && <span className="shrink-0 text-green-500">✓</span>}
      </div>
    );
  }

  return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Colonne gauche — participants non affectés */}
          <div className="lg:col-span-1 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Élèves non affectés ({eleves.length})
              </h3>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {eleves.map((p) => renderDraggable(p, 'ELEVE'))}
                {eleves.length === 0 && (
                  <p className="text-xs text-gray-300 py-1">Tous les élèves sont affectés.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Encadrants non affectés ({encadrants.length})
              </h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {encadrants.map((p) => renderDraggable(p, 'ENCADRANT'))}
                {encadrants.length === 0 && (
                  <p className="text-xs text-gray-300 py-1">Tous les encadrants sont affectés.</p>
                )}
              </div>
            </div>
          </div>

          {/* Colonne droite — chambres (déjà triées étage/ordre par le back) */}
          <div className="lg:col-span-2">
            {groupParEtage ? (
              <div className="space-y-6">
                {groupByEtage(chambres).map((g, gi, groupes) => (
                  <div key={g.etage ?? `sans-etage-${gi}`}>
                    {/* Étage null : pas d'en-tête si c'est le seul groupe (plan à plat),
                        « Autres » dans le cas mixte — pattern RoomingPlanView. */}
                    {(g.etage !== null || groupes.length > 1) && (
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        {g.etage ?? 'Autres'}
                      </h3>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {g.chambres.map((c) => renderChambre(c))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {chambres.map((c) => renderChambre(c))}
              </div>
            )}
          </div>
        </div>
  );
}
