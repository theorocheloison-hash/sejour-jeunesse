'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { useEffect } from 'react';

// Le chrome (sidebar) est fourni par le layout parent (dashboard/layout.tsx → HebergeurShell).
// On conserve ici uniquement l'auth guard : c'est le seul redirect /login des pages hébergeur.
export default function HebergeurLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'HEBERGEUR')) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  return <>{children}</>;
}
