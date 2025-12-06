import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
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
})
