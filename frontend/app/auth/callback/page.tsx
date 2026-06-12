'use client';
import { useEffect, useState, Suspense, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { Logo } from '@/app/components/Logo';
import api from '@/src/lib/api';

const ROLE_ROUTES: Record<string, string> = {
  ORGANISATEUR: '/dashboard/organisateur',
  HEBERGEUR:    '/dashboard/hebergeur',
  SIGNATAIRE:   '/dashboard/signataire',
  ADMIN:        '/dashboard/admin',
  RESEAU:       '/dashboard/reseau',
};

function CallbackContent() {
  const router = useRouter();
  const [needsPassword, setNeedsPassword] = useState(false);
  const [dest, setDest] = useState('/dashboard/organisateur');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Le token et les params sont dans le fragment (#) pour éviter les logs serveur
    const hash = window.location.hash.slice(1); // retire le '#' initial
    const params = new URLSearchParams(hash);

    const token = params.get('token');
    const onboarding = params.get('onboarding');
    const wantsPassword = params.get('needsPassword') === 'true';

    // Nettoyer le hash de l'URL immédiatement (avant tout traitement)
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    // Gérer l'erreur transmise en query param (ce cas vient du backend, pas du hash)
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    if (error === 'magic_link_expired') {
      router.replace('/login?error=magic_link_expired');
      return;
    }

    if (!token) {
      router.replace('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const user = {
        id:        payload.sub,
        email:     payload.email,
        firstName: payload.prenom ?? '',
        lastName:  payload.nom ?? '',
        role:      payload.role,
      };

      Cookies.set('token', token, { expires: 7, sameSite: 'lax' });
      localStorage.setItem('sj_user_v2', JSON.stringify(user));

      const target = ROLE_ROUTES[user.role] ?? '/dashboard/organisateur';
      const finalDest = onboarding === 'true' ? `${target}?onboarding=true` : target;

      if (wantsPassword) {
        // Premier accès via magic link sans mot de passe défini :
        // proposer la création d'un mot de passe avant de rejoindre le dashboard.
        setDest(finalDest);
        setNeedsPassword(true);
      } else {
        router.replace(finalDest);
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const canSubmit = password.length >= 8 && password === confirm && !pending;

  const handleCreatePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      // Le cookie `token` est déjà posé → api ajoute le Bearer automatiquement.
      await api.post('/auth/set-password', { password });
      router.replace(dest);
    } catch {
      setError('Une erreur est survenue. Réessayez ou passez cette étape.');
      setPending(false);
    }
  };

  // Mode par défaut : activation silencieuse + redirection (comportement existant).
  if (!needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-gray-500">Activation de votre espace…</p>
        </div>
      </div>
    );
  }

  // Mode création de mot de passe (needsPassword=true).
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mb-4"><Logo size="md" showTagline={false} /></div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-lg font-bold text-gray-900 mb-1">🔒 Sécurisez votre accès</h1>
          <p className="text-sm text-gray-500 mb-5">
            Créez un mot de passe pour pouvoir vous reconnecter facilement à votre espace LIAVO.
          </p>

          {error && (
            <div role="alert" className="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreatePassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe (min. 8 caractères)
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirmer le mot de passe
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-xs text-red-600">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Création…
                </>
              ) : (
                'Créer mon mot de passe'
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => router.replace(dest)}
            disabled={pending}
            className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700 disabled:opacity-60"
          >
            Passer cette étape →
          </button>
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
