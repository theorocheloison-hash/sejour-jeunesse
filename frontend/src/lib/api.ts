import axios from 'axios';
import Cookies from 'js-cookie';

// Production API URL - Railway deployment
const baseURL = process.env.NEXT_PUBLIC_API_URL || 'https://sejour-jeunesse-production.up.railway.app';

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

export default api;
