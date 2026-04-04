import { create } from 'zustand';
import { THEMES, type ThemeName } from './themeStore';

interface AdminThemeState {
  theme: ThemeName;
  setAdminTheme: (theme: ThemeName) => void;
}

const STORAGE_KEY = 'admin_theme';

const stored = localStorage.getItem(STORAGE_KEY) as ThemeName | null;
const initial: ThemeName = stored && THEMES.some((t) => t.key === stored) ? stored : 'starter';

export const useAdminThemeStore = create<AdminThemeState>((set) => ({
  theme: initial,
  setAdminTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
}));
