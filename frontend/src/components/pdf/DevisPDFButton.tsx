'use client';

import { useState } from 'react';
import type { DevisPDFProps } from './DevisPDF';

interface DevisPDFButtonProps {
  data: DevisPDFProps;
  filename: string;
  label?: string;
}

export default function DevisPDFButton({ data, filename, label = 'T\u00e9l\u00e9charger PDF' }: DevisPDFButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const handleClick = async () => {
    if (blobUrl) {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      return;
    }

    setGenerating(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { default: DevisPDF } = await import('./DevisPDF');
      const blob = await pdf(<DevisPDF {...data} />).toBlob();
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      setReady(true);

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

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {generating ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          G&eacute;n&eacute;ration...
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}
