'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

const TYPES = [
  {
    href: '/register/teacher',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
      </svg>
    ),
    title: 'Je suis enseignant(e)',
    desc: 'Créez et organisez des séjours scolaires pour vos élèves. Accédez aux outils de planification et de suivi.',
    badge: 'Email académique requis',
  },
  {
    href: '/register/venue',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" />
      </svg>
    ),
    title: 'Je suis un hébergement',
    desc: 'Proposez votre centre d\'hébergement aux enseignants. Répondez aux demandes de devis et gérez vos séjours.',
    badge: 'Validation requise',
  },
] as const;

function RegisterContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type');

  // Redirection directe si type préselectionné
  if (type === 'teacher') {
    if (typeof window !== 'undefined') {
      window.location.replace('/register/teacher');
    }
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-transparent" />
      </main>
    );
  }
  if (type === 'venue') {
    if (typeof window !== 'undefined') {
      window.location.replace('/register/venue');
    }
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-primary)] mb-5">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Créer un compte</h1>
          <p className="mt-2 text-gray-500">Choisissez votre type de compte pour commencer</p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 gap-5">
          {TYPES.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group relative bg-white rounded-2xl border-2 border-gray-200 p-6 transition-all hover:border-[var(--color-primary)] hover:shadow-lg hover:shadow-[#003189]/5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary)]/5 text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/10 transition-colors">
                  {t.icon}
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                  {t.badge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">{t.title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
              <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] group-hover:gap-2 transition-all">
                S&apos;inscrire
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          Vous avez déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterChoicePage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-border-strong)] border-t-transparent" />
      </main>
    }>
      <RegisterContent />
    </Suspense>
  );
}
