'use client';

import Link from 'next/link';
import { Logo } from '@/app/components/Logo';
import type { User } from '@/src/types/auth';

const ROLE_LABELS: Record<string, string> = {
  ORGANISATEUR: 'Organisateur',
  SIGNATAIRE:   'Direction / Signataire',
  AUTORITE:     'Autorité',
  PARENT:       'Parent',
  HEBERGEUR:    'Hébergement',
  ADMIN:        'Admin',
  RESEAU:       'Réseau',
};

const ROLE_DASHBOARD_PATH: Record<string, string> = {
  ORGANISATEUR: '/dashboard/organisateur',
  SIGNATAIRE:   '/dashboard/signataire',
  AUTORITE:     '/dashboard',
  PARENT:       '/dashboard/parent',
  HEBERGEUR:    '/dashboard/hebergeur',
  ADMIN:        '/dashboard/admin',
  RESEAU:       '/dashboard/reseau',
};

// Seul l'organisateur avait un lien profil sur le bloc identité — on le conserve.
const ROLE_PROFILE_PATH: Record<string, string> = {
  ORGANISATEUR: '/dashboard/organisateur/profil',
};

interface TopBarShellProps {
  children: React.ReactNode;
  user: User;
  logout: () => void;
}

export default function TopBarShell({ children, user, logout }: TopBarShellProps) {
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
  const profileHref = ROLE_PROFILE_PATH[user.role];

  const identity = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
        <span className="text-xs font-semibold text-[var(--color-primary)]">{initials}</span>
      </div>
      <div className="hidden sm:block leading-tight">
        <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-500">
          {user.organisation?.nom ?? ROLE_LABELS[user.role] ?? user.role}
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Barre de navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href={ROLE_DASHBOARD_PATH[user.role] ?? '/dashboard'} className="flex items-center gap-3">
              <Logo size="sm" showTagline={false} />
            </Link>

            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/10">
                {ROLE_LABELS[user.role] ?? user.role}
              </span>
              {profileHref ? (
                <Link href={profileHref} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                  {identity}
                </Link>
              ) : (
                <div className="flex items-center gap-2.5">
                  {identity}
                </div>
              )}
              <button
                type="button"
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
