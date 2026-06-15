import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black:   '#18181b',
          white:   '#ffffff',
          accent:  '#10b981',
          bg:      'rgb(var(--brand-bg-rgb) / <alpha-value>)',
          surface: 'rgb(var(--brand-surface-rgb) / <alpha-value>)',
          border:  'rgb(var(--brand-border-rgb) / <alpha-value>)',
          text:    'rgb(var(--brand-text-rgb) / <alpha-value>)',
          muted:   'rgb(var(--brand-muted-rgb) / <alpha-value>)',
          hint:    'rgb(var(--brand-hint-rgb) / <alpha-value>)',
          bronze: {
            DEFAULT: 'rgb(var(--brand-bronze-rgb) / <alpha-value>)',
            light:   'rgb(var(--brand-bronze-light-rgb) / <alpha-value>)',
            mid:     'rgb(var(--brand-bronze-mid-rgb) / <alpha-value>)',
          },
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
