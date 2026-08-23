/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0a0a12',
          panel: '#14141f',
          accent: '#7c3aed',
          neon: '#22d3ee',
        },
      },
    },
  },
  plugins: [],
};
