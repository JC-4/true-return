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
        navy: {
          950: '#F5F5F2',  // page background
          900: '#FFFFFF',  // section/card background
          800: '#EBEBEB',  // hover / active light grey
          700: '#1a2744',  // primary dark (buttons)
          600: '#1e3a5f',  // button hover / accent
          500: '#64748B',  // mid grey
          400: '#94A3B8',  // muted
          300: '#CBD5E1',  // borders / light text
          100: '#F0F0ED',  // inner card background
          50:  '#F8F8F6',  // near-white background
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
