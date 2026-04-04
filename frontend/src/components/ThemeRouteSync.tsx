import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useThemeStore } from '../stores/themeStore';
import { useAdminThemeStore } from '../stores/adminThemeStore';

/**
 * Applies either the vendor/main app theme or the admin-only theme to `document.documentElement`
 * based on the current route, so admin appearance does not override the main app or portal.
 */
export function ThemeRouteSync() {
  const location = useLocation();
  const appTheme = useThemeStore((s) => s.theme);
  const adminTheme = useAdminThemeStore((s) => s.theme);
  const isAdminRoute = location.pathname.startsWith('/admin');

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = isAdminRoute ? adminTheme : appTheme;
  }, [isAdminRoute, appTheme, adminTheme]);

  return null;
}
