import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const essai = mode === 'essai';
  return {
    base: './',
    plugins: [
      preact(),
      !essai &&
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: ['apple-touch-icon.png', 'favicon.png'],
          workbox: {
            globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico}'],
            maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
            navigateFallback: 'index.html',
            cleanupOutdatedCaches: true
          },
          manifest: {
            name: 'VintedFlow',
            short_name: 'VintedFlow',
            description: 'Organiser le sourcing, acheter avec discipline et suivre le stock Vinted.',
            lang: 'fr',
            start_url: './',
            scope: './',
            display: 'standalone',
            background_color: '#f4f4f7',
            theme_color: '#4b3bff',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          }
        })
    ].filter(Boolean),
    build: {
      outDir: essai ? 'dist-essai' : 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 1500
    }
  };
});
