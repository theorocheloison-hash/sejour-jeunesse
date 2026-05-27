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
import type { User, LoginDto, OrganisationResume } from '@/src/types/auth';

// ─── Constantes ────────────────────────────────────────────────────────────────

const COOKIE_TOKEN = 'token';
const LS_USER      = 'sj_user_v2';
const LS_USER_OLD  = 'sj_user';
const LS_CENTRE_ACTIF = 'liavo-centre-actif';
const COOKIE_OPTS  = { expires: 7, sameSite: 'lax' as const };

// ─── Multi-centre ─────────────────────────────────────────────────────────────

interface CentreResume {
  id: string;
  nom: string;
  ville: string;
  capacite: number;
  imageUrl: string | null;
  statut: string;
}

const ROLE_ROUTES: Record<string, string> = {
  ORGANISATEUR: '/dashboard/organisateur',
  SIGNATAIRE:   '/dashboard/signataire',
  AUTORITE:     '/dashboard/autorite',
  PARENT:       '/dashboard/parent',
  HEBERGEUR:    '/dashboard/hebergeur',
  ADMIN:        '/dashboard/admin',
  RESEAU:       '/dashboard/reseau',
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (dto: LoginDto, redirectTo?: string) => Promise<void>;
  logout: () => void;
  centres: CentreResume[];
  centreActif: string | null;
  setCentreActif: (id: string) => void;
  isMultiCentre: boolean;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [centres, setCentres]   = useState<CentreResume[]>([]);
  const [centreActif, setCentreActifState] = useState<string | null>(null);
  const router                  = useRouter();

  // Restaure la session depuis le cookie + localStorage au montage
  useEffect(() => {
    // Migration cache v1 → v2 : forcer re-login si ancien format présent
    const oldStored = localStorage.getItem(LS_USER_OLD);
    if (oldStored && !localStorage.getItem(LS_USER)) {
      localStorage.removeItem(LS_USER_OLD);
      Cookies.remove(COOKIE_TOKEN);
      setLoading(false);
      return;
    }

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

  // Charge les centres de l'hébergeur — réagit aux changements d'utilisateur
  useEffect(() => {
    if (!user || user.role !== 'HEBERGEUR') {
      setCentres([]);
      setCentreActifState(null);
      return;
    }
    let cancelled = false;
    api.get<CentreResume[]>('/centres/mes-centres')
      .then(({ data }) => {
        if (cancelled) return;
        setCentres(data);
        const stored = typeof window !== 'undefined'
          ? localStorage.getItem(LS_CENTRE_ACTIF)
          : null;
        const validStored = stored && data.some(c => c.id === stored) ? stored : null;
        const next = validStored ?? data[0]?.id ?? null;
        setCentreActifState(next);
        if (typeof window !== 'undefined' && next && next !== stored) {
          localStorage.setItem(LS_CENTRE_ACTIF, next);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCentres([]);
        setCentreActifState(null);
      });
    return () => { cancelled = true; };
  }, [user]);

  const setCentreActif = useCallback((id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_CENTRE_ACTIF, id);
      window.location.reload();
    }
  }, []);

  const login = useCallback(async (dto: LoginDto, redirectTo?: string) => {
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

    // Enrichir avec l'organisation principale (non bloquant)
    api.get('/users/me').then(({ data }) => {
      if (data.organisation) {
        const enriched: User = { ...user, organisation: data.organisation as OrganisationResume };
        localStorage.setItem(LS_USER, JSON.stringify(enriched));
        setUser(enriched);
      }
    }).catch(() => {});

    router.push(redirectTo ?? ROLE_ROUTES[user.role] ?? '/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    Cookies.remove(COOKIE_TOKEN);
    localStorage.removeItem(LS_USER);
    if (typeof window !== 'undefined') localStorage.removeItem(LS_CENTRE_ACTIF);
    setUser(null);
    setCentres([]);
    setCentreActifState(null);
    router.push('/login');
  }, [router]);

  const isMultiCentre = centres.length > 1;

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, logout,
      centres, centreActif, setCentreActif, isMultiCentre,
    }}>
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
