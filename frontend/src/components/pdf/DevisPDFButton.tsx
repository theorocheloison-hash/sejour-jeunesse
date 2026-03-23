'use client';

import { useState } from 'react';
import type { DevisPDFProps } from './DevisPDF';

interface DevisPDFButtonProps {
  data: DevisPDFProps;
  filename: string;
  label?: string;
  showPreview?: boolean;
}

export default function DevisPDFButton({ data, filename, label = 'PDF', showPreview = true }: DevisPDFButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const generate = async (): Promise<string> => {
    if (blobUrl) return blobUrl;
    const { pdf } = await import('@react-pdf/renderer');
    const { default: DevisPDF } = await import('./DevisPDF');
    const blob = await pdf(<DevisPDF {...data} />).toBlob();
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return url;
  };

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const url = await generate();
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const url = await generate();
      window.open(url, '_blank');
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  if (generating) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
        Génération...
      </span>
    );
  }

  return (
    <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
      {showPreview && (
        <button
          onClick={handlePreview}
          title="Afficher le PDF"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Voir
        </button>
      )}
      <button
        onClick={handleDownload}
        title="Télécharger le PDF"
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        {label}
      </button>
    </div>
  );
}
