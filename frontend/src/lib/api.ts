import axios from 'axios';

const baseURL = '/api';

const api = axios.create({
  baseURL,
});

// ── Header multi-centre ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const centreId = localStorage.getItem('liavo-centre-actif');
    if (centreId) {
      config.headers['X-Centre-Id'] = centreId;
    }
  }
  return config;
});

// ── Refresh token : interceptor 401 ──────────────────────────────────────────
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
      }).then(() => api(originalRequest));
    }

    (originalRequest as any)._retry = true;
    isRefreshing = true;

    try {
      // Le cookie httpOnly refresh_token est envoyé automatiquement (same-origin).
      // Le backend accepte aussi le body vide grâce au dual mode cookie/body.
      await axios.post(`${baseURL}/auth/refresh`);

      // Les nouveaux cookies httpOnly sont posés par le Set-Cookie de la réponse.
      // On signale aux requêtes en queue de retenter.
      processQueue(null);
      isRefreshing = false;

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError);
      isRefreshing = false;

      // Refresh échoué → nettoyage complet + redirect login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sj_user_v2');
        localStorage.removeItem('liavo-centre-actif');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
