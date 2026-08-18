import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '명료 연습실',
        short_name: '명료',
        description: '설명·논쟁·토론을 위한 글쓰기 연습실',
        lang: 'ko',
        display: 'standalone',
        background_color: '#efe7d8',
        theme_color: '#1f4b6e',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,ico}'],
      },
    }),
  ],
})
