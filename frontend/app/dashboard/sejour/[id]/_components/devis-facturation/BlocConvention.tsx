'use client';

import { useState } from 'react';
import { genererConvention } from '@/src/lib/devis';
import SecureFileLink from '@/src/components/SecureFileLink';
import api from '@/src/lib/api';

/**
 * Carte « Convention de séjour » (lien de téléchargement si générée, aperçu,
 * génération/renvoi si droit d'écriture). Auto-contenu : loading/success vivent ici.
 * Le SEUL bit paramétré entre DIRECT et COLLAB est `contactEmail` (message de
 * confirmation d'envoi) : DIRECT → clientEmail du séjour, COLLAB → email du créateur.
 * La condition d'affichage reste dans chaque branche du parent.
 */
export interface BlocConventionProps {
  devisId: string;
  conventionUrl: string | null;
  contactEmail: string | null | undefined;
  peutEcrireDevis: boolean;
  onReload: () => Promise<void>;
  onError: (m: string) => void;
}

export default function BlocConvention({
  devisId,
  conventionUrl,
  contactEmail,
  peutEcrireDevis,
  onReload,
  onError,
}: BlocConventionProps) {
  const [conventionLoading, setConventionLoading] = useState(false);
  const [conventionSuccess, setConventionSuccess] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Aperçu PDF sans effet de bord (pas d'envoi). Ouvre le PDF dans un nouvel onglet.
  const handlePreviewConvention = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.get(`/devis/${devisId}/convention/preview`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
    } catch {
      onError('Erreur lors de la prévisualisation de la convention');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Génère + envoie la convention par email au contact (après confirmation).
  const handleGenererConvention = async () => {
    const cible = contactEmail || 'l\'établissement';
    if (!window.confirm(`La convention sera envoyée par email à ${cible}. Continuer ?`)) return;
    setConventionLoading(true);
    setConventionSuccess(false);
    try {
      await genererConvention(devisId);
      await onReload();
      setConventionSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Erreur lors de la génération de la convention';
      onError(msg);
    } finally {
      setConventionLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Convention de séjour</h3>
      </div>

      {conventionUrl && (
        <SecureFileLink
          url={conventionUrl}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] underline hover:opacity-80"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          📄 Télécharger la convention
        </SecureFileLink>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handlePreviewConvention}
          disabled={previewLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {previewLoading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          )}
          {previewLoading ? 'Ouverture…' : '👁 Prévisualiser'}
        </button>
        {peutEcrireDevis && (
          <button
            onClick={handleGenererConvention}
            disabled={conventionLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1B4060] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {conventionLoading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {conventionLoading ? 'Envoi…' : conventionUrl ? '📤 Renvoyer au client' : '📤 Envoyer au client'}
          </button>
        )}
      </div>

      {conventionSuccess && (
        <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
          ✅ Convention générée et envoyée par email
        </p>
      )}
    </div>
  );
}
