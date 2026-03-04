'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import axios from 'axios';
import api from '@/src/lib/api';
import type { User, LoginDto } from '@/src/types/auth';

// ─── Constantes ────────────────────────────────────────────────────────────────

const COOKIE_TOKEN = 'token';
const LS_USER      = 'sj_user';
const COOKIE_OPTS  = { expires: 7, sameSite: 'lax' as const };

const ROLE_ROUTES: Record<string, string> = {
  TEACHER:     '/dashboard/teacher',
  DIRECTOR:    '/dashboard/director',
  ACCOUNTANT:  '/dashboard/accountant',
  RECTOR:      '/dashboard/rector',
  PARENT:      '/dashboard/parent',
  VENUE:       '/dashboard/venue',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (dto: LoginDto) => Promise<void>;
  logout: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const router                  = useRouter();

  // Restaure la session depuis le cookie + localStorage au montage
  useEffect(() => {
    const token = Cookies.get(COOKIE_TOKEN);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const stored = localStorage.getItem(LS_USER);
      if (stored) setUser(JSON.parse(stored) as User);
    } catch {
      // localStorage corrompu — on ignore
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (dto: LoginDto) => {
    // Le backend retourne prenom/nom — type fidèle à la réponse réelle
    type BackendLoginResponse = {
      access_token: string;
      user: { id: string; email: string; prenom: string; nom: string; role: User['role'] };
    };

    const { data } = await api.post<BackendLoginResponse>('/auth/login', dto);

    const user: User = {
      id:        data.user.id,
      email:     data.user.email,
      firstName: data.user.prenom,
      lastName:  data.user.nom,
      role:      data.user.role,
    };

    Cookies.set(COOKIE_TOKEN, data.access_token, COOKIE_OPTS);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    setUser(user);

    router.push(ROLE_ROUTES[user.role] ?? '/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    Cookies.remove(COOKIE_TOKEN);
    localStorage.removeItem(LS_USER);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>');
  return ctx;
}

// ─── Helper pour extraire le message d'une AxiosError ──────────────────────────

export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Impossible de contacter le serveur';
    const msg = err.response.data?.message as string | string[] | undefined;
    return Array.isArray(msg) ? msg[0] : (msg ?? 'Identifiants invalides');
  }
  return 'Impossible de contacter le serveur';
}
