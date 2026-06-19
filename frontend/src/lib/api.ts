import axios from 'axios';
import Cookies from 'js-cookie';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  // js-cookie n'est disponible que côté navigateur
  const token =
    typeof window !== 'undefined' ? Cookies.get('token') : undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    token ? resolve(token) : reject(error);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Ne pas refresh pour les routes auth (login, register, refresh lui-même)
    // ni pour les requêtes déjà retentées
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
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    (originalRequest as any)._retry = true;
    isRefreshing = true;

    const refreshToken = typeof window !== 'undefined'
      ? localStorage.getItem('liavo-refresh-token')
      : null;

    if (!refreshToken) {
      isRefreshing = false;
      // Pas de refresh token → nettoyage + redirect login
      if (typeof window !== 'undefined') {
        Cookies.remove('token');
        localStorage.removeItem('sj_user_v2');
        localStorage.removeItem('liavo-refresh-token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });

      // Stocker les nouveaux tokens
      Cookies.set('token', data.access_token, { expires: 7, sameSite: 'lax' as const });
      if (data.refresh_token) {
        localStorage.setItem('liavo-refresh-token', data.refresh_token);
      }

      processQueue(null, data.access_token);
      isRefreshing = false;

      originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      isRefreshing = false;

      // Refresh échoué → nettoyage complet + redirect login
      if (typeof window !== 'undefined') {
        Cookies.remove('token');
        localStorage.removeItem('sj_user_v2');
        localStorage.removeItem('liavo-refresh-token');
        window.location.href = '/login';
      }
      return Promise.reject(refreshError);
    }
  },
);

export default api;
