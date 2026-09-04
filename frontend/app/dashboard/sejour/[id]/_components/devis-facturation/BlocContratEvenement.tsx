'use client';

import { useState } from 'react';
import { previewContratEvenement } from '@/src/lib/devis';

/**
 * Carte « Contrat événement » + bouton de prévisualisation du contrat PDF
 * (avant envoi du devis, nature EVENEMENT). Auto-contenu : le loading vit ici.
 * Partagé DIRECT / COLLABORATIF ; la condition d'affichage reste au parent.
 */
export interface BlocContratEvenementProps {
  devisId: string;
  onError: (m: string) => void;
}

export default function BlocContratEvenement({ devisId, onError }: BlocContratEvenementProps) {
  const [contratPreviewLoading, setContratPreviewLoading] = useState(false);

  // Aperçu PDF du contrat événement (avant envoi du devis) — pas d'effet de bord.
  const handlePreviewContrat = async () => {
    setContratPreviewLoading(true);
    try {
      await previewContratEvenement(devisId);
    } catch {
      onError('Erreur lors de la prévisualisation du contrat');
    } finally {
      setContratPreviewLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Contrat événement</h3>
      <button
        onClick={handlePreviewContrat}
        disabled={contratPreviewLoading}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {contratPreviewLoading && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        )}
        {contratPreviewLoading ? 'Ouverture…' : '👁 Prévisualiser le contrat'}
      </button>
    </div>
  );
}
