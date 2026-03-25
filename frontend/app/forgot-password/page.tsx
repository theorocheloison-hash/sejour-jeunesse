'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/src/lib/api';
import { Logo } from '@/app/components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch { setSent(true); } // Toujours afficher succès
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4"><Logo size="md" showTagline={false} /></div>
          <p className="text-sm text-gray-500">Réinitialisation du mot de passe</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-success-light)] mx-auto">
                <svg className="w-6 h-6 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-sm text-gray-700 font-medium">Email envoyé</p>
              <p className="text-xs text-gray-500">Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien dans quelques minutes. Vérifiez vos spams.</p>
              <Link href="/login" className="block text-sm font-semibold text-[var(--color-primary)] hover:underline mt-2">Retour à la connexion</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.fr"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
              </button>
              <Link href="/login" className="block text-center text-sm text-gray-500 hover:underline">Retour à la connexion</Link>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
