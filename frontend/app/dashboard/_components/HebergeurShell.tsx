'use client';
import { useState } from 'react';
import HebergeurSidebar from '../hebergeur/_components/HebergeurSidebar';
import { useHebergeurCounts } from '../hebergeur/_components/useHebergeurCounts';
import { usePermissions } from '@/src/hooks/usePermissions';
import PlanInsufficientModal from '@/src/components/PlanInsufficientModal';
import { Logo } from '@/app/components/Logo';

export default function HebergeurShell({ children, logout }: { children: React.ReactNode; logout: () => void }) {
  const { centre, demandesCount, rappelsCount, actionsFactCount, sejoursNonLusCount } = useHebergeurCounts();
  const { perms, loading: permissionsLoading } = usePermissions();
  // Drawer mobile (< md). En ≥ md la sidebar est toujours visible, cet état est sans effet.
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top-bar mobile : hamburger + logo. Cachée en ≥ md. */}
        <header className="md:hidden print:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-gray-200 bg-white px-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg width={22} height={22} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex flex-1 justify-center">
            <Logo size="sm" showTagline={false} />
          </div>
          <div className="w-10" aria-hidden="true" />
        </header>
        {children}
      </div>
      <PlanInsufficientModal />
    </div>
  );
}
