'use client';

import type { ReactNode } from 'react';
import { useSecureUrl } from '@/src/hooks/useSecureUrl';

interface SecureFileLinkProps {
  url: string | null | undefined;
  children: ReactNode;
  className?: string;
  download?: boolean;
}

export default function SecureFileLink({ url, children, className, download }: SecureFileLinkProps) {
  const signedUrl = useSecureUrl(url);

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
