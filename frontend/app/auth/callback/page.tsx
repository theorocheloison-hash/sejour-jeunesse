'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Cookies from 'js-cookie';

function CallbackContent() {
  const router = useRouter();

  useEffect(() => {
    // Le token et les params sont dans le fragment (#) pour éviter les logs serveur
    const hash = window.location.hash.slice(1); // retire le '#' initial
    const params = new URLSearchParams(hash);

    const token = params.get('token');
    const onboarding = params.get('onboarding');

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

      const roleRoutes: Record<string, string> = {
        ORGANISATEUR: '/dashboard/organisateur',
        HEBERGEUR:    '/dashboard/hebergeur',
        SIGNATAIRE:   '/dashboard/signataire',
        ADMIN:        '/dashboard/admin',
        RESEAU:       '/dashboard/reseau',
      };

      const dest = roleRoutes[user.role] ?? '/dashboard/organisateur';
      router.replace(onboarding === 'true' ? `${dest}?onboarding=true` : dest);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent mx-auto mb-4" />
        <p className="text-sm text-gray-500">Activation de votre espace…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
