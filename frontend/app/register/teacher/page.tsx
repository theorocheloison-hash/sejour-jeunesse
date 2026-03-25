'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import api from '@/src/lib/api';
import { extractApiError } from '@/src/contexts/AuthContext';

function RegisterTeacherContent() {
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    password: '',
    telephone: '',
    etablissementUai: '',
    etablissementNom: '',
    etablissementAdresse: '',
    etablissementVille: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Établissement search
  const [etabQuery, setEtabQuery] = useState('');
  const [etabTypeFilter, setEtabTypeFilter] = useState<string>('');
  const [etabResults, setEtabResults] = useState<Array<{ uai: string; nom: string; type: string; adresse: string; codePostal: string; commune: string; academie: string }>>([]);
  const [etabSearching, setEtabSearching] = useState(false);
  const etabDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const etabAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (etabDebounceRef.current) clearTimeout(etabDebounceRef.current);
      if (etabAbortRef.current) etabAbortRef.current.abort();
    };
  }, []);

  const fireEtabSearch = (query: string, type: string) => {
    if (etabDebounceRef.current) clearTimeout(etabDebounceRef.current);
    if (query.length < 3 && !type) { setEtabResults([]); return; }
    if (query.length < 3 && type) {
      // type seul — recherche immédiate sans debounce
      if (etabAbortRef.current) etabAbortRef.current.abort();
      const controller = new AbortController();
      etabAbortRef.current = controller;
      setEtabSearching(true);
      api.get('/etablissements/recherche', { params: { q: undefined, type: type || undefined }, signal: controller.signal })
        .then(res => setEtabResults(res.data))
        .catch(() => {})
        .finally(() => setEtabSearching(false));
      return;
    }
    etabDebounceRef.current = setTimeout(async () => {
      if (etabAbortRef.current) etabAbortRef.current.abort();
      const controller = new AbortController();
      etabAbortRef.current = controller;
      setEtabSearching(true);
      try {
        const res = await api.get('/etablissements/recherche', { params: { q: query, type: type || undefined }, signal: controller.signal });
        setEtabResults(res.data);
      } catch { /* aborted or error */ }
      finally { setEtabSearching(false); }
    }, 400);
  };

  const handleEtabSearch = (value: string) => {
    setEtabQuery(value);
    fireEtabSearch(value, etabTypeFilter);
  };

  useEffect(() => {
    if (form.etablissementNom) return; // already selected
    fireEtabSearch(etabQuery, etabTypeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etabTypeFilter]);

  const selectEtab = (e: typeof etabResults[0]) => {
    setForm(f => ({ ...f, etablissementUai: e.uai, etablissementNom: e.nom, etablissementAdresse: e.adresse ?? '', etablissementVille: e.commune }));
    setEtabResults([]);
    setEtabQuery('');
  };

  const clearEtab = () => {
    setForm(f => ({ ...f, etablissementUai: '', etablissementNom: '', etablissementAdresse: '', etablissementVille: '' }));
  };

  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams.get('redirect');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await api.post('/auth/register/teacher', form);
      if (redirectAfterLogin) {
        sessionStorage.setItem('liavo_redirect_after_login', redirectAfterLogin);
      }
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
            href={redirectAfterLogin ? `/login?redirect=${encodeURIComponent(redirectAfterLogin)}` : '/login'}
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
          <p className="mt-1 text-sm text-gray-500">Créez votre compte enseignant</p>
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email professionnel</label>
              <input id="email" type="email" required disabled={isPending} value={form.email} onChange={set('email')}
                placeholder="votre@email.fr"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50" />
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

            {/* Établissement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0.5">Votre établissement</label>
              <p className="text-xs text-gray-400 mb-1.5">(optionnel)</p>
              {form.etablissementNom ? (
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{form.etablissementNom}</p>
                    <p className="text-xs text-gray-500 truncate">{form.etablissementVille}{form.etablissementUai ? ` — ${form.etablissementUai}` : ''}</p>
                  </div>
                  <button type="button" onClick={clearEtab} className="text-xs text-red-500 hover:underline shrink-0">Effacer</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {([['École', 'Ecole'], ['Collège', 'Collège'], ['Lycée', 'Lycée']] as const).map(([label, value]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setEtabTypeFilter(prev => prev === value ? '' : value)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          etabTypeFilter === value
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={etabQuery}
                      onChange={e => handleEtabSearch(e.target.value)}
                      placeholder="Nom, ville ou code postal"
                      disabled={isPending}
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:opacity-50"
                    />
                    {etabSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent inline-block" />
                      </div>
                    )}
                    {etabResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {etabResults.map(e => (
                          <button
                            key={e.uai}
                            type="button"
                            onClick={() => selectEtab(e)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <p className="text-sm font-medium text-gray-900 truncate">{e.nom}</p>
                            <p className="text-xs text-gray-500 truncate">{e.commune} — {e.type}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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

export default function RegisterTeacherPage() {
  return (
    <Suspense>
      <RegisterTeacherContent />
    </Suspense>
  );
}
