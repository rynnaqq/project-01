/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0f0f23',
          panel: '#1e1c35',
          muted: '#27273b',
          line: '#4c1d95',
          primary: '#7c3aed',
          soft: '#a78bfa',
          accent: '#f43f5e',
          neon: '#22d3ee',
        },
      },
      fontFamily: {
        display: ['"Russo One"', 'system-ui', 'sans-serif'],
        body: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-sm': '0 0 14px rgba(124, 58, 237, 0.35)',
        glow: '0 0 28px rgba(124, 58, 237, 0.45)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.35)',
        'glow-rose': '0 0 26px rgba(244, 63, 94, 0.4)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2.4s ease-in-out infinite',
        rise: 'rise 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};
