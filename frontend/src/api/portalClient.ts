import axios from 'axios';

/** Axios instance for `/api/portal` — uses `portalToken`, not vendor `token`. */
const portalClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3002/api',
  headers: { 'Content-Type': 'application/json' },
});

portalClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('portalToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('portalToken');
      localStorage.removeItem('portalSession');
      const path = window.location.pathname;
      if (!path.startsWith('/portal/login')) {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(error);
  }
);

export default portalClient;
