'use client';

import { useSecureUrl } from '@/src/hooks/useSecureUrl';

interface SecureImageProps {
  url: string | null | undefined;
  alt?: string;
  className?: string;
  /** Si true, un clic ouvre l'URL signée dans un nouvel onglet. */
  openOnClick?: boolean;
}

export default function SecureImage({ url, alt = '', className, openOnClick }: SecureImageProps) {
  const signedUrl = useSecureUrl(url);

  if (!signedUrl) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 48,
        }}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      className={className}
      onClick={openOnClick ? () => window.open(signedUrl, '_blank') : undefined}
      style={openOnClick ? { cursor: 'pointer' } : undefined}
    />
  );
}
