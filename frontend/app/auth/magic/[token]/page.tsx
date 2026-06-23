'use client';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function MagicLinkPage() {
  const { token } = useParams<{ token: string }>();

  useEffect(() => {
    if (token) {
      // Navigation pleine page vers le backend via le proxy rewrite.
      // Le backend consomme le magic link, pose les cookies httpOnly,
      // et redirige (302) vers /auth/callback#token=...
      window.location.href = `/api/auth/magic/${token}`;
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
