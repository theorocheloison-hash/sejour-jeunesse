import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr';

const api = axios.create({
  baseURL,
  withCredentials: true, // cookies httpOnly envoyés automatiquement par le navigateur
});

// Header X-Centre-Id (multi-centre hébergeur) — inchangé
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const centreId = localStorage.getItem('liavo-centre-actif');
    if (centreId) {
      config.headers['X-Centre-Id'] = centreId;
    }
  }
  return config;
});

// ── Refresh token : interceptor 401 ──────────────────────────────────────
// Le refresh token est dans un cookie httpOnly — le navigateur l'envoie
// automatiquement sur POST /auth/refresh. Plus besoin de le stocker en JS.
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

    // Ne pas refresh pour les routes auth ni pour les requêtes déjà retentées
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

    // Si un refresh est déjà en cours, mettre en queue
    if (isRefreshing) {
      return new Promise<void>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(() => api(originalRequest)); // retry — cookie déjà rafraîchi
    }

    (originalRequest as any)._retry = true;
    isRefreshing = true;

    try {
      // POST /auth/refresh sans body — le cookie refresh_token est envoyé automatiquement
      await api.post('/auth/refresh');

      processQueue(null);
      isRefreshing = false;

      // Retry la requête originale — le nouveau cookie token est déjà posé par le backend
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      isRefreshing = false;

      // Refresh échoué → nettoyage + redirect login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sj_user_v2');
        localStorage.removeItem('liavo-refresh-token'); // cleanup legacy
        localStorage.removeItem('liavo-centre-actif');
        try { await api.post('/auth/logout'); } catch { /* best effort */ }
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
