import type { Config } from 'tailwindcss'

/* Colours resolve through the semantic `--c-*` tokens defined in
 * app/globals.css, so the same utility renders in the legacy cream theme or the
 * Offplan Source theme depending on whether it sits inside `.theme-os`.
 *
 * Only `ink`, `paper`, `tl` and `td` support an alpha modifier
 * (`bg-brand-ink/60`) — they are backed by RGB triplets. The semantic tokens
 * are color-mix() results, which can't carry <alpha-value>; where a translucent
 * variant is needed there is a dedicated token for it. */
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
          /* Palette primitives — alpha-capable */
          ink:   'rgb(var(--ink-rgb) / <alpha-value>)',
          paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
          tl:    'rgb(var(--tl-rgb) / <alpha-value>)',
          td:    'rgb(var(--td-rgb) / <alpha-value>)',

          /* Semantic — theme-aware */
          bg:           'var(--c-ground)',
          surface:      'var(--c-surface)',
          raise:        'var(--c-raise)',
          border:       'var(--c-border)',
          'border-subtle': 'var(--c-border-subtle)',
          text:         'var(--c-text)',
          muted:        'var(--c-muted)',
          hint:         'var(--c-hint)',
          'hint-faint': 'var(--c-hint-faint)',

          accent:       'var(--c-accent)',
          'accent-hover': 'var(--c-accent-hover)',
          'accent-soft': 'var(--c-accent-soft)',
          'accent-mid': 'var(--c-accent-mid)',
          'on-accent':  'var(--c-on-accent)',

          inverse:      'var(--c-inverse)',
          'inverse-deep':  'var(--c-inverse-deep)',
          'inverse-line':  'var(--c-inverse-line)',
          'inverse-raise': 'var(--c-inverse-raise)',
          'on-inverse':       'var(--c-on-inverse)',
          'on-inverse-muted': 'var(--c-on-inverse-muted)',
          'on-inverse-hint':  'var(--c-on-inverse-hint)',

          pos:       'var(--c-pos)',
          'pos-soft':'var(--c-pos-soft)',
          neg:       'var(--c-neg)',
          'neg-soft':'var(--c-neg-soft)',
          warn:      'var(--c-warn)',
          'warn-soft':'var(--c-warn-soft)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-schibsted-grotesk)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
