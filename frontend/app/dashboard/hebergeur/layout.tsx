'use client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { useEffect } from 'react';
import HebergeurSidebar from './_components/HebergeurSidebar';
import { useHebergeurCounts } from './_components/useHebergeurCounts';
import { usePermissions } from '@/src/hooks/usePermissions';

export default function HebergeurLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount } = useHebergeurCounts();
  const { perms, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'HEBERGEUR')) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HebergeurSidebar
        centre={centre}
        demandesCount={demandesCount}
        rappelsCount={rappelsCount}
        actionsFactCount={actionsFactCount}
        sejoursNonLusCount={sejoursNonLusCount}
        permissions={perms}
        permissionsLoading={permissionsLoading}
        onLogout={logout}
      />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
