import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'

// https://vite.dev/config/
// Use function form to avoid reading local HTTPS certs during CI builds
export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  return {
    // Allow GitHub Pages base path via env; default to '/'
    base: process.env.BASE_PATH || '/',
    plugins: [vue()],
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('/vue')) return 'vendor-vue'
              if (id.includes('leaflet')) return 'vendor-leaflet'
              if (id.includes('xlsx') || id.includes('excel') || id.includes('sheetjs')) return 'vendor-xlsx'
              return 'vendor'
            }
          }
        }
      }
    },
    server: isServe
      ? {
          https: {
            key: readFileSync('./localhost+2-key.pem'),
            cert: readFileSync('./localhost+2.pem')
          },
          proxy: {
            '/auth': {
              target: 'https://bcknd.fly.dev',
              changeOrigin: true,
              secure: true
            },
            '/api': {
              target: 'https://bcknd.fly.dev',
              changeOrigin: true,
              secure: true
            }
          }
        }
      : undefined
  }
})
