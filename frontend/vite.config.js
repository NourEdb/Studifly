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
        // Pre-cache built JS/CSS/icons/fonts — but NOT html. index.html is
        // deliberately left out of the precache (see the runtimeCaching rule
        // below): precaching it is what caused the blank-page-after-deploy
        // bug, since a precached index.html is served cache-first and keeps
        // referencing JS chunk hashes from the old deploy that Vercel no
        // longer has once a new deploy goes out.
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
        // vite-plugin-pwa defaults this to 'index.html' internally and merges
        // it in UNDER whatever this object sets — simply omitting the key
        // leaves that default in place, registering an extra NavigationRoute
        // bound to a precache entry that (deliberately) no longer exists,
        // which would 404 every navigation. Must be explicitly unset here.
        navigateFallback: undefined,
        // Every navigation (page load / SPA route entry) goes to the network
        // first, so the shell is always the latest deploy's index.html; only
        // if the network is unreachable does it fall back to whatever was
        // last successfully cached for that path.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 10,
            },
          },
        ],
        // A waiting new SW activates immediately instead of waiting for
        // every open tab to close (skipWaiting), and immediately takes
        // control of already-open tabs once active (clientsClaim) — together
        // these are what make a deploy actually take effect without the user
        // needing to close and reopen the app.
        skipWaiting: true,
        clientsClaim: true,
        // Deletes precache caches left behind by previous SW versions so
        // they don't accumulate indefinitely across deploys.
        cleanupOutdatedCaches: true,
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
