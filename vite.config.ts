import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves a project site under /<repo>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  // MathLive is imported lazily (the working pad); pre-bundle it so dev doesn't reload mid-session.
  optimizeDeps: { include: ['mathlive'] },
  plugins: [
    react(),
    // Installable and fully offline once visited. The service worker is registered by hand in
    // main.tsx (production only) and stays disabled in dev so the e2e suite isn't affected.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'MathPath',
        short_name: 'MathPath',
        description: "Daily math & economics practice for the econ master's",
        theme_color: '#3b5bdb',
        background_color: '#f6f7fb',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // KaTeX ships woff2 + woff + ttf per font; woff2 covers every modern browser.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        // The main chunk is ~1.3 MB because of mathjs.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
})
