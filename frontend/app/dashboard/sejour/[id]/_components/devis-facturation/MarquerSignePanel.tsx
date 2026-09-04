'use client';

import { useState, useRef } from 'react';
import api from '@/src/lib/api';

/**
 * Bouton « Enregistrer la signature … » + panneau de saisie (nom du signataire,
 * scan PDF optionnel) → POST /devis/:id/marquer-signe (multipart). Auto-contenu :
 * show/nom/loading/fileRef vivent ici. Le parent garde la condition de gate et
 * calcule le libellé du bouton (client vs direction selon la branche/statut).
 */
export interface MarquerSignePanelProps {
  devisId: string;
  buttonLabel: string;
  onReload: () => Promise<void>;
  onError: (m: string) => void;
}

export default function MarquerSignePanel({
  devisId,
  buttonLabel,
  onReload,
  onError,
}: MarquerSignePanelProps) {
  const [show, setShow] = useState(false);
  const [nom, setNom] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        onClick={() => { setShow(true); setNom(''); }}
        className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {buttonLabel}
      </button>
      {show && (
        <div className="w-full mt-2 rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-purple-800">Enregistrer une signature reçue hors plateforme</p>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Nom du signataire</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="ex: Mme Dupont, Directrice"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Document signé (PDF, optionnel)</label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="block w-full text-xs text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-purple-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-purple-700 hover:file:bg-purple-200"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShow(false)}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const formData = new FormData();
                  if (nom.trim()) {
                    formData.append('nomSignataire', nom.trim());
                  }
                  const file = fileRef.current?.files?.[0];
                  if (file) {
                    formData.append('file', file);
                  }
                  await api.post(`/devis/${devisId}/marquer-signe`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  setShow(false);
                  await onReload();
                } catch (err) {
                  console.error('[marquer-signe]', err);
                  onError('Une erreur est survenue. Veuillez réessayer.');
                } finally {
                  setLoading(false);
                  if (fileRef.current) fileRef.current.value = '';
                }
              }}
              disabled={loading}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Enregistrement…' : 'Confirmer la signature'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
