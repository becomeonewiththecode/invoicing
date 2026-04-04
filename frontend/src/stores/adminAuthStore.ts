import { create } from 'zustand';
import type { User } from '../types';

const USER_KEY = 'admin_user';
const TOKEN_KEY = 'admin_token';

interface AdminAuthState {
  user: User | null;
  token: string | null;
  setAdminAuth: (user: User, token: string) => void;
  adminLogout: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  token: localStorage.getItem(TOKEN_KEY),
  setAdminAuth: (user, token) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token });
  },
  adminLogout: () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },
}));
