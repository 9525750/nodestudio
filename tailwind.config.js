/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#22d3ee',
          green: '#4ade80',
          purple: '#a855f7',
          pink: '#ec4899',
          yellow: '#e5ff33',
          orange: '#fb923c',
        },
        studio: {
          bg: '#030303',
          surface: '#0a0a0a',
          border: 'rgba(255,255,255,0.06)',
          'border-hover': 'rgba(255,255,255,0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(34,211,238,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(34,211,238,0.6)' },
        },
      },
    },
  },
  plugins: [],
};
