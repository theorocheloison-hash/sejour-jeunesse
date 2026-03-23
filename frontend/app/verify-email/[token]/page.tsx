'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/src/lib/api';

type Status = 'loading' | 'success' | 'already' | 'error';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => {
    if (!token) return;
    api.post(`/auth/verify-email/${token}`)
      .then(({ data }) => {
        setMessage(data.message);
        const isSuccess = !data.message?.includes('déjà');
        setStatus(isSuccess ? 'success' : 'already');
        if (isSuccess) {
          const redirect = sessionStorage.getItem('liavo_redirect_after_login');
          if (redirect) {
            setLoginHref(`/login?redirect=${encodeURIComponent(redirect)}`);
            sessionStorage.removeItem('liavo_redirect_after_login');
          }
        }
      })
      .catch((err) => {
        setMessage(err?.response?.data?.message ?? 'Lien de vérification invalide ou expiré.');
        setStatus('error');
      });
  }, [token]);

  const configs: Record<Status, { bg: string; iconBg: string; iconColor: string; icon: React.ReactNode }> = {
    loading: {
      bg: 'bg-gray-50',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-400',
      icon: <span className="h-8 w-8 animate-spin rounded-full border-3 border-gray-300 border-t-[#003189]" />,
    },
    success: {
      bg: 'bg-gray-50',
      iconBg: 'bg-[var(--color-success-light)]',
      iconColor: 'text-[var(--color-success)]',
      icon: (
        <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    already: {
      bg: 'bg-gray-50',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      icon: (
        <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-gray-50',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      icon: (
        <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      ),
    },
  };

  const c = configs[status];

  return (
    <main className={`min-h-screen flex items-center justify-center ${c.bg} px-4`}>
      <div className="w-full max-w-sm text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${c.iconBg} mb-6`}>
          {c.icon}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {status === 'loading' && 'Vérification en cours...'}
          {status === 'success' && 'Email vérifié !'}
          {status === 'already' && 'Déjà vérifié'}
          {status === 'error' && 'Erreur de vérification'}
        </h1>

        <p className="text-gray-500 mb-6">{message || 'Veuillez patienter...'}</p>

        {status !== 'loading' && (
          <Link
            href={loginHref}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90"
          >
            {loginHref !== '/login' ? 'Se connecter et rejoindre le séjour' : 'Se connecter'}
          </Link>
        )}
      </div>
    </main>
  );
}
