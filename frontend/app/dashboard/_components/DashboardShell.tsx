'use client';

import { logoutAction } from '../actions';

const ROLE_LABELS: Record<string, string> = {
  TEACHER:  'Enseignant',
  DIRECTOR: 'Directeur',
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900">Séjour Jeunesse</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
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
