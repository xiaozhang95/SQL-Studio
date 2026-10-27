import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Swagger 独立构建，工作台无需加载文档 UI；Go 可直接提供同一份静态页面。
  build: {
    rollupOptions: {
      input: { app: fileURLToPath(new URL('./index.html', import.meta.url)), swagger: fileURLToPath(new URL('./swagger.html', import.meta.url)) }
    }
  },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false } }
  }
})
