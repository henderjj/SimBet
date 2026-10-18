import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Cloudflare Web Analytics, added to production builds only so local
// development doesn't show up as visits.
const cloudflareAnalytics = (): Plugin => ({
  name: 'cloudflare-analytics',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'script',
      attrs: {
        type: 'module',
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': '{"token": "2b6d5e1dcbc94470af42577fa942d8e1"}',
      },
      injectTo: 'body',
    },
  ],
})

export default defineConfig({
  // Relative base so the build works at any path (GitHub Pages serves it under /<repo>/).
  base: './',
  plugins: [react(), cloudflareAnalytics()],
})
