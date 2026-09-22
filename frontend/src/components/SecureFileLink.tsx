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
  title?: string;
}

export default function SecureFileLink({ url, children, className, download, filename, title }: SecureFileLinkProps) {
  const signedUrl = useSecureUrl(url, filename);

  if (!signedUrl) {
    return (
      <span className={className} title={title} style={{ opacity: 0.5, cursor: 'wait' }}>
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
      title={title}
      {...(download ? { download: true } : {})}
    >
      {children}
    </a>
  );
}
