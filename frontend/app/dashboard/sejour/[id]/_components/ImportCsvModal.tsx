'use client';

import { useState } from 'react';
import { importAutorisationsCsv } from '@/src/lib/autorisation';
import { fichierVersCsv, modeleInscriptionXlsx } from '@/src/lib/inscription-csv';

/**
 * Modale d'import CSV d'une liste COMPLÈTE d'inscrits (grille de saisie
 * directe, Lot 6) — pattern repris de la modale d'InscriptionsEleves,
 * sans le tunnel Pronote/ONDE (ici on importe le modèle rempli).
 * Le modèle vide téléchargeable reflète les champs demandés du séjour.
 */
interface Props {
  sejourId: string;
  champsActifs: string[];
  onImported: () => void;
  onClose: () => void;
}

export default function ImportCsvModal({ sejourId, champsActifs, onImported, onClose }: Props) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
    columnsDetected?: string[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      // .xlsx/.xls → converti en CSV ; côté back rien ne change
      const fichier = await fichierVersCsv(importFile);
      const result = await importAutorisationsCsv(sejourId, fichier);
      setImportResult(result);
      // ≥1 ligne créée → recharge puis fermeture (les nouveaux inscrits
      // apparaissent dans la grille). created === 0 → la modale reste ouverte
      // pour montrer le récap (doublons, erreurs, colonnes détectées).
      if (result.created > 0) {
        onImported();
        onClose();
      }
    } catch (e: any) {
      setImportError(e?.response?.data?.message ?? "Erreur lors de l'import du fichier.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-bold text-gray-900">Importer une liste remplie (CSV ou Excel)</h3>
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

        <div className="px-6 py-5 space-y-5">
          {/* Modèle vide : colonnes = champs demandés de CE séjour */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900 flex items-center justify-between gap-4 flex-wrap">
            <p className="flex-1 min-w-[220px]">
              Les colonnes du modèle correspondent aux champs demandés pour ce séjour —
              remplissez-le puis importez-le tel quel.
            </p>
            <button
              type="button"
              onClick={() => modeleInscriptionXlsx(champsActifs)}
              className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-900 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              Télécharger le modèle vide
            </button>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setImportFile(f);
            }}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragActive
                ? 'border-[var(--color-primary)] bg-blue-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <svg className="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            {importFile ? (
              <p className="text-sm text-gray-900 font-medium">{importFile.name}</p>
            ) : (
              <p className="text-sm text-gray-500">Glissez-déposez votre fichier CSV ou Excel ici</p>
            )}
            <label className="inline-block mt-3 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Parcourir
              <input
                type="file"
                accept=".csv,.txt,.tsv,.xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
          </div>

          {importError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {importError}
            </div>
          )}

          {importResult && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--color-success)]">
                {importResult.created} élève{importResult.created > 1 ? 's' : ''} importé{importResult.created > 1 ? 's' : ''}
              </p>
              {importResult.columnsDetected && importResult.columnsDetected.length > 0 && (
                <p className="text-xs text-gray-500">
                  Colonnes détectées : {importResult.columnsDetected.join(', ')}
                </p>
              )}
              {importResult.skipped > 0 && (
                <p className="text-sm text-gray-500">
                  {importResult.skipped} ignoré{importResult.skipped > 1 ? 's' : ''} (doublons ou lignes vides)
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Erreurs :</p>
                  <ul className="text-xs text-red-700 space-y-0.5 list-disc list-inside">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!importFile || importing}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Import…' : 'Importer'}
          </button>
        </div>
      </div>
    </div>
  );
}
