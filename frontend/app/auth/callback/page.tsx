'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Cookies from 'js-cookie';

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    const onboarding = searchParams.get('onboarding');
    const error = searchParams.get('error');

    if (error === 'magic_link_expired') {
      router.replace('/login?error=magic_link_expired');
      return;
    }

    if (!token) {
      router.replace('/login');
      return;
    }

    // Décoder le payload JWT pour récupérer le rôle (sans vérifier la signature)
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
      // Ajouter ?onboarding=true pour afficher le message de bienvenue + création mdp
      router.replace(onboarding ? `${dest}?onboarding=true` : dest);
    } catch {
      router.replace('/login');
    }
  }, [searchParams, router]);

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
