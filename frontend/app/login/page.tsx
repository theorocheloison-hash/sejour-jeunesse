'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, extractApiError } from '@/src/contexts/AuthContext';
import { Logo } from '@/app/components/Logo';
import api from '@/src/lib/api';

function LoginForm() {
  const { login }                   = useAuth();
  const searchParams                = useSearchParams();
  const redirectTo                  = searchParams.get('redirect') ?? undefined;
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [isPending, setIsPending]   = useState(false);
  const [compteDormant, setCompteDormant] = useState(false);
  const [magicLinkEnvoye, setMagicLinkEnvoye] = useState(false);
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [emailNonVerifie, setEmailNonVerifie] = useState(false);
  const [compteEnAttente, setCompteEnAttente] = useState(false);
  const [verifEnvoye, setVerifEnvoye] = useState(false);
  const [verifPending, setVerifPending] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setCompteDormant(false);
    setEmailNonVerifie(false);
    setCompteEnAttente(false);
    setIsPending(true);
    try {
      await login({ email, password }, redirectTo);
    } catch (err: unknown) {
      const msg = extractApiError(err);
      if (msg === 'COMPTE_DORMANT') {
        setCompteDormant(true);
      } else if (msg === 'EMAIL_NON_VERIFIE') {
        setEmailNonVerifie(true);
      } else if (msg === 'COMPTE_EN_ATTENTE_VALIDATION') {
        setCompteEnAttente(true);
      } else {
        setError(msg);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleRenvoyerMagicLink = async () => {
    setMagicLinkPending(true);
    try {
      await api.post('/auth/renvoyer-magic-link', { email });
      setMagicLinkEnvoye(true);
    } catch { /* non bloquant */ }
    finally { setMagicLinkPending(false); }
  };

  const handleRenvoyerVerification = async () => {
    setVerifPending(true);
    try {
      await api.post('/auth/resend-verification', { email });
      setVerifEnvoye(true);
    } catch { /* non bloquant */ }
    finally { setVerifPending(false); }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <Logo size="md" showTagline={false} />
          </div>
          <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace</p>
        </div>

        {/* Carte */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {/* Erreur */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {compteDormant && !magicLinkEnvoye && (
            <div className="mb-5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Vous avez déjà soumis une demande via LIAVO.</p>
              <p className="text-blue-700 mb-3">
                Votre espace n&apos;a pas encore été activé. Cliquez ci-dessous pour recevoir
                un nouveau lien d&apos;accès par email.
              </p>
              <button type="button" onClick={handleRenvoyerMagicLink} disabled={magicLinkPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {magicLinkPending
                  ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                  : 'Recevoir un lien d\'accès par email'}
              </button>
            </div>
          )}
          {magicLinkEnvoye && (
            <div className="mb-5 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)] font-medium">
              Lien envoyé — vérifiez votre boîte mail (et vos spams).
            </div>
          )}

          {/* Email non vérifié — proposer de renvoyer le lien de vérification */}
          {emailNonVerifie && !verifEnvoye && (
            <div className="mb-5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Vérifiez votre email avant de vous connecter.</p>
              <p className="text-amber-700 mb-3">
                Un lien de confirmation vous a été envoyé. Vous pouvez en demander un nouveau ci-dessous.
              </p>
              <button type="button" onClick={handleRenvoyerVerification} disabled={verifPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                {verifPending
                  ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                  : "Renvoyer l'email de vérification"}
              </button>
            </div>
          )}
          {verifEnvoye && (
            <div className="mb-5 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)] font-medium">
              Email de vérification renvoyé — vérifiez votre boîte mail (et vos spams).
            </div>
          )}

          {/* Hébergeur en attente de validation par l'équipe — aucune action possible */}
          {compteEnAttente && (
            <div className="mb-5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-4 text-sm text-blue-800">
              <p className="font-semibold mb-1">Votre compte est en attente de validation.</p>
              <p className="text-blue-700">
                Notre équipe examine votre demande. Vous recevrez un email dès que votre accès
                sera activé.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                disabled={isPending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent disabled:cursor-not-allowed disabled:bg-gray-50"
              />
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-[var(--color-primary)] hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={isPending}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Connexion en cours…
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Pas encore de compte ?{' '}
          <Link href="/register" className="font-semibold text-[var(--color-primary)] hover:underline">
            Créer un compte
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-gray-500 w-full block">
          Besoin d&apos;aide ?{' '}
          <a href="mailto:contact@liavo.fr" className="font-medium text-[var(--color-primary)] hover:underline">
            contact@liavo.fr
          </a>
        </p>

        <p className="mt-4 text-center text-xs text-gray-400">
          Liavo &copy; {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
