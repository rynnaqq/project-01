/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#06080f',
          panel: '#0b1220',
          muted: '#141d31',
          line: '#233250',
          // Spectrum semantics: mint = action, cyan = info, gold = achievement,
          // rose = energy/alerts.
          primary: '#41f2b8',
          soft: '#a7f5dc',
          neon: '#43d9ff',
          accent: '#ff4d88',
          gold: '#ffc857',
          ink: '#04241a',
        },
      },
      fontFamily: {
        display: ['"Unbounded"', 'system-ui', 'sans-serif'],
        body: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 24px 48px -24px rgba(2, 6, 16, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.14)',
        'glass-sm': '0 12px 32px -20px rgba(2, 6, 16, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'underglow-mint': '0 14px 34px -14px rgba(65, 242, 184, 0.55)',
        'underglow-cyan': '0 14px 34px -14px rgba(67, 217, 255, 0.45)',
        'underglow-rose': '0 14px 34px -14px rgba(255, 77, 136, 0.5)',
        'underglow-gold': '0 14px 34px -14px rgba(255, 200, 87, 0.45)',
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
