'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

// Correspondance rôle → route dashboard
const ROLE_ROUTES: Record<string, string> = {
  TEACHER:  '/dashboard/teacher',
  DIRECTOR: '/dashboard/director',
  RECTOR:   '/dashboard/rector',
  PARENT:   '/dashboard/parent',
  VENUE:    '/dashboard/venue',
};

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export type LoginState = { error: string } | null;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email    = formData.get('email') as string;
  const password = formData.get('password') as string;

  let accessToken: string;
  let role: string;

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { message?: string | string[] };
      // class-validator renvoie parfois un tableau de messages
      const msg = Array.isArray(body.message) ? body.message[0] : body.message;
      return { error: msg ?? 'Identifiants invalides' };
    }

    const data = await res.json() as {
      access_token: string;
      user: { role: string };
    };

    accessToken = data.access_token;
    role        = data.user.role;
  } catch {
    return { error: 'Impossible de contacter le serveur. Réessayez.' };
  }

  // Le cookie doit être posé avant redirect() — les deux sont hors du bloc try/catch
  const cookieStore = await cookies();
  cookieStore.set('token', accessToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7, // 7 jours
    path:     '/',
  });

  redirect(ROLE_ROUTES[role] ?? '/dashboard');
}
