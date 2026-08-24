import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        // key keeps the nested path so output lands at dist/rail-rush/index.html
        'rail-rush/index': 'rail-rush/index.html',
      },
    },
  },
});
