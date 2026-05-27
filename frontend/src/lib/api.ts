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

export default api;
