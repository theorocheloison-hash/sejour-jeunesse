'use client';

import { useState, useEffect } from 'react';
import api from '@/src/lib/api';

/**
 * Résout une URL de fichier S3 en URL signée via le backend.
 * Retourne l'URL signée une fois chargée, null pendant le chargement.
 * Fallback sur l'URL originale si le signing échoue (fichier public ou erreur).
 */
export function useSecureUrl(url: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;

    api
      .get<{ signedUrl: string }>('/storage/signed-url', { params: { url } })
      .then(({ data }) => {
        if (!cancelled) setSignedUrl(data.signedUrl);
      })
      .catch(() => {
        if (!cancelled) setSignedUrl(url);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return signedUrl;
}
