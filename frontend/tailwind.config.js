/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
          'light-border': 'var(--color-primary-light-border)',
          text: 'var(--color-primary-text)',
        },
        sidebar: {
          bg: 'var(--color-sidebar-bg)',
          text: 'var(--color-sidebar-text)',
          muted: 'var(--color-sidebar-muted)',
          hover: 'var(--color-sidebar-hover)',
          active: 'var(--color-sidebar-active)',
          border: 'var(--color-sidebar-border)',
        },
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          alt: 'var(--color-surface-alt)',
        },
        border: 'var(--color-border)',
        'input-border': 'var(--color-input-border)',
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        'focus-ring': 'var(--color-focus-ring)',
      },
      ringColor: {
        focus: 'var(--color-focus-ring)',
      },
    },
  },
  plugins: [],
}
