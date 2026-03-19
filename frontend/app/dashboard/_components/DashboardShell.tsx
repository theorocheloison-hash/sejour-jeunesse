'use client';

import { logoutAction } from '../actions';
import { Logo } from '@/app/components/Logo';

const ROLE_LABELS: Record<string, string> = {
  TEACHER:  'Enseignant',
  DIRECTOR: 'Direction',
  RECTOR:   'Recteur',
  PARENT:   'Parent',
  VENUE:    'Hébergement',
};

interface DashboardShellProps {
  role: string;
  title: string;
  children: React.ReactNode;
}

export default function DashboardShell({ role, title, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Barre de navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Logo size="sm" showTagline={false} />
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/10">
              {ROLE_LABELS[role] ?? role}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </nav>

      {/* Contenu */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
