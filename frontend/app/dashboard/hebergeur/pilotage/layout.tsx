'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/hebergeur/pilotage/ca', label: 'CA & Remplissage' },
  { href: '/dashboard/hebergeur/pilotage/rentabilite', label: 'Rentabilité' },
  { href: '/dashboard/hebergeur/pilotage/comptabilite', label: 'Comptabilité' },
  { href: '/dashboard/hebergeur/pilotage/equipe', label: 'Équipe', badge: 'Bientôt' },
];

export default function PilotageLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Header + Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-base font-semibold text-gray-900 pt-4 pb-2">Pilotage</h1>
          <div className="flex gap-1 -mb-px">
            {TABS.map(tab => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                    active
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-1.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5">
                      {tab.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Contenu de l'onglet actif */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}
