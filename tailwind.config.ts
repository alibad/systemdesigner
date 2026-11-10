import type { Config } from 'tailwindcss';

// Human Quest "Path" look (8 Nov 2026). The app is built on Tailwind's greys, so its greys take the
// family's warm paper and ink: the same lightness step for step (contrast stays as it was), a warm hue.
// Light steps are the day paper and cards, dark steps the after-sunset browns, so every `dark:` pair
// keeps working. `white` is the family card colour. See components/hq-path/system-designer-path.css.
const pathGreys = {
  50: '#fbf6ee',
  100: '#f4ecdf',
  200: '#e9ddca',
  300: '#d8c7ae',
  400: '#a8947e',
  500: '#7b6856',
  600: '#5e4d3f',
  700: '#4d3c2f',
  800: '#3a2a1f',
  900: '#2a1d15',
  950: '#1c130e',
};

// System Designer's own green (main #05875f, soft #8fd6bb, deep #065f46, night #06976b) as a scale,
// for accents on the public pages. 600 is a shade under the main colour so small text and button
// labels stay above 4.5:1 on the cream paper.
const brand = {
  50: '#eef8f3',
  100: '#d5efe3',
  200: '#b2e3cf',
  300: '#8fd6bb',
  400: '#4fb98f',
  500: '#05875f',
  600: '#057a56',
  700: '#056c4e',
  800: '#065f46',
  900: '#064e3b',
  950: '#032b21',
};

export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{mdoc,mdx}',
    './markdoc/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        white: '#fffaf1',
        neutral: pathGreys,
        gray: pathGreys,
        slate: pathGreys,
        zinc: pathGreys,
        brand,
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: '0 10px 30px rgba(0,0,0,0.10)',
        hover: '0 16px 40px rgba(0,0,0,0.12)'
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'glass': 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

