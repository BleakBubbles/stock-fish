/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import palette from './art/palette.json' with { type: 'json' };

const water = `#${palette.ui.water}`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.png'],
      manifest: {
        name: 'Bullish Sharks',
        short_name: 'Bullish',
        description: 'Your portfolio as a tank of pixel-art sharks.',
        theme_color: water,
        background_color: water,
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // React and Dexie in their own chunks: they change far less often than
        // the app, so browsers and the service worker keep them across deploys.
        // PixiJS stays with the app: grouping it would also pull in the parts
        // it loads only when needed.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|scheduler)\// },
            { name: 'dexie', test: /node_modules\/(dexie|dexie-react-hooks)\// },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
