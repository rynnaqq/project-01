/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          // Memphis Design system — clashing 80s brights on warm paper.
          bg: '#fbf3e4',
          panel: '#fffdf8',
          muted: '#f3ead8',
          line: '#1a1611',
          primary: '#ffce5c', // sun yellow — action highlights
          soft: '#ffe9a8',
          neon: '#2ba8a0', // deepened teal for text-safe accents
          accent: '#ff71ce', // hot pink — energy
          gold: '#ffb03a', // amber — achievements
          ink: '#1a1611',
          sea: '#86ccca',
          peri: '#6a7bb4',
        },
      },
      fontFamily: {
        display: ['"Bungee"', 'system-ui', 'sans-serif'],
        body: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'pop-sm': '3px 3px 0 0 #1a1611',
        pop: '6px 6px 0 0 #1a1611',
        'pop-lg': '10px 10px 0 0 #1a1611',
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(-3deg)' },
          '50%': { transform: 'translateY(-8px) rotate(3deg)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          to: { transform: 'translateX(-50%)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        // Countdown numeral: a quick elastic pop on every new second.
        tick: {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.16) rotate(2deg)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        bob: 'bob 4s ease-in-out infinite',
        wiggle: 'wiggle 1.6s ease-in-out infinite',
        rise: 'rise 0.5s ease-out both',
        marquee: 'marquee 20s linear infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        tick: 'tick 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
