import { THEMES, type ThemeName } from './stores/themeStore';

function pickValid(key: string | null): ThemeName | null {
  if (!key) return null;
  return THEMES.some((t) => t.key === key) ? (key as ThemeName) : null;
}

/** Run before React so the first paint uses the correct palette for the current route. */
export function bootstrapDocumentTheme(): void {
  const path = window.location.pathname;
  const isAdmin = path.startsWith('/admin');
  const raw = isAdmin ? localStorage.getItem('admin_theme') : localStorage.getItem('theme');
  const theme = pickValid(raw) ?? 'starter';
  document.documentElement.dataset.theme = theme;
}
