import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr';

const api = axios.create({
  baseURL,
  withCredentials: true, // cookie httpOnly envoyé si le navigateur coopère
  adapter: 'xhr',
});

// ── Token en mémoire (backup du cookie httpOnly) ──────────────────────────
// Le backend retourne access_token dans le body (backward compat Phase 1).
// On le stocke en mémoire JS et on l'envoie via Authorization header.
// Le dual extractor backend lit le cookie d'abord, puis le header en fallback.
// Perdu au refresh page → récupéré via /auth/refresh au prochain init.
let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

// ── Request interceptor : Authorization + X-Centre-Id ────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    if (inMemoryToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    const centreId = localStorage.getItem('liavo-centre-actif');
    if (centreId) {
      config.headers['X-Centre-Id'] = centreId;
    }
  }
  return config;
});

// ── Response interceptor : refresh 401 ───────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    error ? reject(error) : resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      !originalRequest ||
      originalRequest.url?.startsWith('/auth/') ||
      (originalRequest as any)._retry
    ) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(originalRequest));
    }

    (originalRequest as any)._retry = true;
    isRefreshing = true;

    try {
      // fetch natif pour le refresh — envoie le cookie de manière fiable
      // (contrairement à axios dans le contexte React/Next.js)
      const refreshRes = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!refreshRes.ok) throw new Error('refresh failed');
      const refreshData = await refreshRes.json();
      if (refreshData?.access_token) {
        inMemoryToken = refreshData.access_token;
      }

      processQueue(null);
      isRefreshing = false;

      // Retry avec le nouveau token en mémoire (header Authorization)
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      isRefreshing = false;

      if (typeof window !== 'undefined') {
        inMemoryToken = null;
        localStorage.removeItem('sj_user_v2');
        localStorage.removeItem('liavo-refresh-token');
        localStorage.removeItem('liavo-centre-actif');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
