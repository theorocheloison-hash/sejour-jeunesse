'use client';

import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import HebergeurShell from './_components/HebergeurShell';
import TopBarShell from './_components/TopBarShell';

function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-100 bg-white py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-gray-400">
          © 2026 LIAVO SASU · SIRET 102 994 910 00010 · RCS Annecy
        </span>
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
          <Link href="/legal/mentions-legales" className="hover:text-gray-600 transition-colors">Mentions légales</Link>
          <Link href="/legal/cgu" className="hover:text-gray-600 transition-colors">CGU</Link>
          <Link href="/legal/confidentialite" className="hover:text-gray-600 transition-colors">Confidentialité</Link>
          <Link href="/legal/cgv-hebergeurs" className="hover:text-gray-600 transition-colors">CGV Hébergeurs</Link>
        </div>
      </div>
    </footer>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();

  // Les auth guards (redirects) restent dans chaque page — ici on ne fournit que le chrome.
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (user.role === 'HEBERGEUR') {
    return (
      <HebergeurShell logout={logout}>
        {children}
        <Footer />
      </HebergeurShell>
    );
  }

  return (
    <TopBarShell user={user} logout={logout}>
      <div className="flex flex-col min-h-[calc(100vh-4rem)]">
        <div className="flex-1">{children}</div>
        <Footer />
      </div>
    </TopBarShell>
  );
}
