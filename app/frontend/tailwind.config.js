/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bronze: {
          50: '#FBF4EA',
          100: '#F1DFC3',
          300: '#D7A972',
          500: '#B07B3A',
          600: '#8C5E24',
          700: '#6A4517',
          900: '#2E1C08',
        },
        silver: {
          100: '#EFF2F5',
          300: '#C6CBD1',
          500: '#93A0AC',
          700: '#3F4A55',
          900: '#1B2028',
        },
        gold: {
          100: '#FFF4C8',
          300: '#FFD977',
          500: '#F1B02C',
          600: '#C88B12',
          700: '#8E6108',
          900: '#3B2702',
        },
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.04), 0 20px 40px -20px rgba(0,0,0,0.6)',
        glow: '0 0 60px -10px rgba(241,176,44,0.35)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.3)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        pulseDot: 'pulseDot 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
