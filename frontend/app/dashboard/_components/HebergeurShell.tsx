'use client';
import HebergeurSidebar from '../hebergeur/_components/HebergeurSidebar';
import { useHebergeurCounts } from '../hebergeur/_components/useHebergeurCounts';
import { usePermissions } from '@/src/hooks/usePermissions';
import PlanInsufficientModal from '@/src/components/PlanInsufficientModal';

export default function HebergeurShell({ children, logout }: { children: React.ReactNode; logout: () => void }) {
  const { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount } = useHebergeurCounts();
  const { perms, loading: permissionsLoading } = usePermissions();

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HebergeurSidebar
        centre={centre}
        planAbonnement={centre?.planAbonnement ?? null}
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
      <PlanInsufficientModal />
    </div>
  );
}
