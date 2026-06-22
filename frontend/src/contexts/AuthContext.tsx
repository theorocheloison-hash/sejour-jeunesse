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
import axios from 'axios';
import api from '@/src/lib/api';
import type { User, LoginDto, OrganisationResume } from '@/src/types/auth';

// ─── Constantes ────────────────────────────────────────────────────────────────

const LS_USER      = 'sj_user_v2';
const LS_USER_OLD  = 'sj_user';
const LS_CENTRE_ACTIF = 'liavo-centre-actif';

// ─── Multi-centre ─────────────────────────────────────────────────────────────

interface CentreResume {
  id: string;
  nom: string;
  ville: string;
  capacite: number;
  imageUrl: string | null;
  statut: string;
  isOwned: boolean;
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

  // Restaure la session depuis localStorage au montage
  useEffect(() => {
    // Migration cache v1 → v2 : forcer re-login si ancien format présent
    const oldStored = localStorage.getItem(LS_USER_OLD);
    if (oldStored && !localStorage.getItem(LS_USER)) {
      localStorage.removeItem(LS_USER_OLD);
      setLoading(false);
      return;
    }

    // Restaure l'user depuis localStorage (hint UI).
    // La validation réelle se fait via le cookie httpOnly sur la première requête API.
    // Si le cookie a expiré → 401 → refresh interceptor → redirect login.
    try {
      const stored = localStorage.getItem(LS_USER);
      if (stored) {
        setUser(JSON.parse(stored) as User);
        setLoading(false);
        return;
      }
    } catch {
      // localStorage corrompu — on ignore
    }

    // httpOnly cookie : JS ne peut pas lire le token.
    // Vérifier la session côté serveur si localStorage est vide.
    // fetch natif (et non api.get) pour bypasser l'interceptor 401 → refresh
    // qui boucle en incognito sans cookie (redirect /login → remount → relance).
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr';
    fetch(`${apiBase}/users/me`, { credentials: 'include' })
      .then(r => {
        if (!r.ok) throw new Error('not authenticated');
        return r.json();
      })
      .then((data: any) => {
        if (data?.id) {
          const restored: User = {
            id: data.id,
            email: data.email,
            firstName: data.prenom,
            lastName: data.nom,
            role: data.role,
          };
          localStorage.setItem(LS_USER, JSON.stringify(restored));
          setUser(restored);
        }
      })
      .catch(() => {
        // Pas de session valide — rester déconnecté
      })
      .finally(() => {
        setLoading(false);
      });
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
      refresh_token?: string;
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

    // Tokens gérés par cookies httpOnly (posés par le backend) — rien à stocker côté JS
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

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch { /* best effort — le backend clear les cookies */ }
    localStorage.removeItem(LS_USER);
    localStorage.removeItem('liavo-refresh-token'); // cleanup legacy
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
