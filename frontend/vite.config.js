import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use our own public/manifest.json instead of a generated one
      manifest: false,
      registerType: 'autoUpdate',
      workbox: {
        // Pre-cache all built JS, CSS, HTML, and common asset types
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Return the shell for any navigation request (SPA routing)
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
      },
    }
  }
});
