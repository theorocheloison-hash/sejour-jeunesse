'use client';

import type { ReactNode } from 'react';
import { useSecureUrl } from '@/src/hooks/useSecureUrl';

interface SecureFileLinkProps {
  url: string | null | undefined;
  children: ReactNode;
  className?: string;
  download?: boolean;
  /** Nom imposé au téléchargement (Content-Disposition signé côté S3). */
  filename?: string;
}

export default function SecureFileLink({ url, children, className, download, filename }: SecureFileLinkProps) {
  const signedUrl = useSecureUrl(url, filename);

  if (!signedUrl) {
    return (
      <span className={className} style={{ opacity: 0.5, cursor: 'wait' }}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      {...(download ? { download: true } : {})}
    >
      {children}
    </a>
  );
}
