'use client';

import { useState } from 'react';
import { colonnesInscription } from '@/src/lib/inscription-csv';
import { CHAMP_PAR_CLE } from '@/src/lib/champs-inscription';

/**
 * Modale de sélection des colonnes AVANT export de la liste des inscrits
 * (brique B1 inscriptions v2) — ex. liste cuisine = Identité + régime, sans
 * les données parents. Source unique : colonnesInscription (même contrat que
 * l'export et la grille). Tout est coché par défaut ; l'export sans
 * modification reste identique à l'historique.
 */
interface Props {
  champsActifs: string[];
  onExport: (cles: string[]) => void;
  onClose: () => void;
}

const CLES_IDENTITE = ['eleveNom', 'elevePrenom', 'eleveDateNaissance'];
const CLES_CONTACT = ['nomParent', 'telephoneUrgence', 'parentEmail'];

export default function ExportColonnesModal({ champsActifs, onExport, onClose }: Props) {
  const colonnes = colonnesInscription(champsActifs, true);

  // Bloc B = tout ce qui n'est ni identité ni contact ; santé séparée via le
  // flag métier (mapping key→champ par la colonne, garde ?. si clé inconnue).
  const estSante = (key: string) =>
    Object.values(CHAMP_PAR_CLE).find((c) => c.colonne === key)?.sante === true;

  const groupes = [
    { titre: 'Identité', cols: colonnes.filter((c) => CLES_IDENTITE.includes(c.key)) },
    {
      titre: 'Champs du séjour',
      cols: colonnes.filter(
        (c) => !CLES_IDENTITE.includes(c.key) && !CLES_CONTACT.includes(c.key) && !estSante(c.key),
      ),
    },
    { titre: 'Santé', cols: colonnes.filter((c) => estSante(c.key)) },
    { titre: 'Contact parent', cols: colonnes.filter((c) => CLES_CONTACT.includes(c.key)) },
  ].filter((g) => g.cols.length > 0);

  const [cochees, setCochees] = useState<Set<string>>(new Set(colonnes.map((c) => c.key)));

  const toggle = (key: string) => {
    setCochees((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroupe = (keys: string[], toutCoche: boolean) => {
    setCochees((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (toutCoche ? next.delete(k) : next.add(k)));
      return next;
    });
  };

  const handleExport = () => {
    // Ordre canonique des colonnes préservé (on filtre la liste source, pas le Set)
    onExport(colonnes.filter((c) => cochees.has(c.key)).map((c) => c.key));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900">Exporter la liste des inscrits</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fermer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-500">
            Choisissez les colonnes à inclure — par exemple une liste pour la cuisine
            sans les coordonnées des parents.
          </p>
          {groupes.map((g) => {
            const keys = g.cols.map((c) => c.key);
            const toutCoche = keys.every((k) => cochees.has(k));
            return (
              <div key={g.titre} className="rounded-xl border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toutCoche}
                    onChange={() => toggleGroupe(keys, toutCoche)}
                    className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                  />
                  {g.titre}
                </label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 pl-6">
                  {g.cols.map((c) => (
                    <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cochees.has(c.key)}
                        onChange={() => toggle(c.key)}
                        className="h-4 w-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={cochees.size === 0}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Exporter ({cochees.size} colonne{cochees.size > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
