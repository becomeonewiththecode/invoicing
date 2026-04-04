import { THEMES, useThemeStore, type ThemeName } from '../stores/themeStore';
import { useAdminThemeStore } from '../stores/adminThemeStore';

interface ThemePickerPanelProps {
  /** `app` = vendor app + portal palette; `admin` = admin panel only (separate storage). */
  scope?: 'app' | 'admin';
  /** Shown under the "Appearance" heading */
  description?: string;
  className?: string;
}

export function ThemePickerPanel({
  scope = 'app',
  description = 'Color theme for the app. Saved in this browser only.',
  className = '',
}: ThemePickerPanelProps) {
  const appTheme = useThemeStore((s) => s.theme);
  const setAppTheme = useThemeStore((s) => s.setTheme);
  const adminTheme = useAdminThemeStore((s) => s.theme);
  const setAdminTheme = useAdminThemeStore((s) => s.setAdminTheme);
  const theme = scope === 'admin' ? adminTheme : appTheme;
  const setTheme = scope === 'admin' ? setAdminTheme : setAppTheme;

  return (
    <div className={`bg-surface rounded-xl shadow-sm p-6 border border-border ${className}`}>
      <h2 className="text-sm font-semibold text-text uppercase tracking-wide mb-1">Appearance</h2>
      <p className="text-sm text-text-muted mb-4">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const selected = theme === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key as ThemeName)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected
                  ? 'border-primary ring-2 ring-focus ring-offset-2 ring-offset-surface'
                  : 'border-border hover:bg-surface-alt'
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border shadow-sm">
                <span className="h-full w-1/2" style={{ background: t.swatch[0] }} />
                <span className="h-full w-1/2" style={{ background: t.swatch[1] }} />
              </span>
              <span>
                <span className="block font-medium text-text">{t.label}</span>
                <span className="block text-xs text-text-muted">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
