'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import api from '@/src/lib/api';
import { extractApiError } from '@/src/contexts/AuthContext';

export default function RegisterTeacherPage() {
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    telephone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await api.post('/auth/register/teacher', form);
      setSuccess(true);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setIsPending(false);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-success-light)] mb-6">
            <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez votre email</h1>
          <p className="text-gray-500 mb-6">
            Un email de vérification a été envoyé à <strong className="text-gray-700">{form.email}</strong>.
            Cliquez sur le lien dans l&apos;email pour activer votre compte.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 mb-6">
            Pensez à vérifier vos spams si vous ne trouvez pas l&apos;email.
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour à la connexion
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/register" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--color-primary)] mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Retour
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-primary)] mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Inscription enseignant</h1>
          <p className="mt-1 text-sm text-gray-500">Utilisez votre adresse email académique</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="prenom" className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                <input id="prenom" type="text" required disabled={isPending} value={form.prenom} onChange={set('prenom')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
              </div>
              <div>
                <label htmlFor="nom" className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                <input id="nom" type="text" required disabled={isPending} value={form.nom} onChange={set('nom')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email académique</label>
              <input id="email" type="email" required disabled={isPending} value={form.email} onChange={set('email')}
                placeholder="prenom.nom@ac-paris.fr"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
              <p className="mt-1 text-xs text-gray-400">Adresse en @ac-*.fr ou @education.gouv.fr</p>
            </div>

            <div>
              <label htmlFor="telephone" className="block text-sm font-medium text-gray-700 mb-1.5">
                Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input id="telephone" type="tel" disabled={isPending} value={form.telephone} onChange={set('telephone')}
                placeholder="06 12 34 56 78"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <input id="password" type="password" required disabled={isPending} value={form.password} onChange={set('password')}
                placeholder="8 caractères minimum"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
            </div>

            <button type="submit" disabled={isPending}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {isPending ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Inscription en cours...</>
              ) : (
                "S'inscrire"
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">Se connecter</Link>
        </p>
        <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Besoin d&apos;aide ?{' '}
          <a href="mailto:contact@liavo.fr" style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
            contact@liavo.fr
          </a>
        </p>
      </div>
    </main>
  );
}
