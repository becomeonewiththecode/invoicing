import { create } from 'zustand';

export type ThemeName = 'starter' | 'forest' | 'twilight' | 'ember';

export const THEMES: { key: ThemeName; label: string; description: string; swatch: [string, string] }[] = [
  { key: 'starter', label: 'Starter', description: 'Clean blue-violet', swatch: ['#0A2540', '#635BFF'] },
  { key: 'forest', label: 'Forest', description: 'Natural green', swatch: ['#161B22', '#238636'] },
  { key: 'twilight', label: 'Twilight', description: 'Grey and black', swatch: ['#0A0A0A', '#52525B'] },
  { key: 'ember', label: 'Ember', description: 'Warm coral', swatch: ['#F7F6F3', '#E04545'] },
];

interface ThemeState {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const stored = localStorage.getItem('theme') as ThemeName | null;
const initial: ThemeName = stored && THEMES.some((t) => t.key === stored) ? stored : 'starter';

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
}));
