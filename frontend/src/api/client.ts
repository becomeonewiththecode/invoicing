import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const url = config.url ?? '';
  const isAdminApi = url.startsWith('/admin');
  const token = isAdminApi ? localStorage.getItem('admin_token') : localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function isPublicAuthPath(url: string): boolean {
  // 401 here means wrong credentials / validation — not an expired session; do not redirect.
  return url.startsWith('/auth/login') || url.startsWith('/auth/register');
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? '';
      if (isPublicAuthPath(url)) {
        return Promise.reject(error);
      }
      const isAdminApi = url.startsWith('/admin');
      if (isAdminApi) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = '/admin';
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
