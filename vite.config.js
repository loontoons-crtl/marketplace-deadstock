import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api requests go to the Express server so cookies stay same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: false },
      '/uploads': { target: process.env.VITE_API_PROXY || 'http://localhost:4000', changeOrigin: false },
    },
  },
});
