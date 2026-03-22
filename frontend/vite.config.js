import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // ОТКЛЮЧАЕМ SOURCE MAPS В PRODUCTION!
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Удаляем console.log в production
        drop_debugger: true  // Удаляем debugger
      }
    },
    rollupOptions: {
      output: {
        // Убираем имена исходных файлов
        sourcemapIgnoreList: () => true
      }
    }
  },
  server: {
    port: process.env.PORT || 3000,
    host: '0.0.0.0',
    allowedHosts: ['all'],
    hmr: {
      clientPort: 443,
      protocol: 'wss'
    },
    watch: {
      usePolling: true
    }
  }
})
