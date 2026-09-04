'use client';

import React, { useState, useEffect } from 'react';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';
import SecureFileLink from '@/src/components/SecureFileLink';

function DevisPDFInline({ data }: { data: DevisPDFProps }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { pdf } = await import('@react-pdf/renderer');
        const { default: DevisPDF } = await import('@/src/components/pdf/DevisPDF');
        const blob = await pdf(<DevisPDF {...data} />).toBlob();
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-48 rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        Génération du PDF...
      </div>
    </div>
  );

  if (!url) return null;

  return (
    <iframe
      src={url}
      className="w-full rounded-2xl border border-gray-200 shadow-sm"
      style={{ height: '80vh', minHeight: 600 }}
      title="Aperçu du devis"
    />
  );
}

/**
 * Viewer PDF du devis : documentUrl présent → lien de téléchargement + iframe 80vh ;
 * sinon → rendu client-side du PDF (DevisPDFInline). Partagé DIRECT / COLLABORATIF ;
 * le parent construit les pdfProps (pdfPropsDirect / pdfProps) et garde DevisPDFButton.
 */
export interface DevisPdfViewerProps {
  documentUrl: string | null;
  pdfProps: DevisPDFProps;
}

export default function DevisPdfViewer({ documentUrl, pdfProps }: DevisPdfViewerProps) {
  return documentUrl ? (
    <div className="space-y-3">
      <SecureFileLink
        url={documentUrl}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Télécharger le devis PDF
      </SecureFileLink>
      <iframe
        src={documentUrl}
        className="w-full rounded-2xl border border-gray-200 shadow-sm"
        style={{ height: '80vh', minHeight: 600 }}
        title="Aperçu du devis"
      />
    </div>
  ) : (
    <DevisPDFInline data={pdfProps} />
  );
}
