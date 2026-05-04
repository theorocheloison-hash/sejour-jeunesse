'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.liavo.fr';

export default function MagicLinkPage() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      window.location.href = `${API_BASE}/auth/magic/${token}`;
    }
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-gray-500">Connexion en cours…</p>
      </div>
    </div>
  );
}
