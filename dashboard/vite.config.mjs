import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep the CRA-era REACT_APP_* names so the Vercel env vars need no renaming.
  envPrefix: ['VITE_', 'REACT_APP_'],
  // Vercel's output directory is build/ (CRA default); keep it.
  build: { outDir: 'build' },
  server: { port: 3000 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
});
