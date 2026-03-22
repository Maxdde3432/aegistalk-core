import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devHost = process.env.VITE_DEV_HOST || '127.0.0.1'
const devPort = Number(process.env.PORT || process.env.VITE_DEV_PORT || 5173)

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
    port: devPort,
    host: devHost,
    strictPort: true,
    allowedHosts: ['all'],
    hmr: {
      host: devHost,
      clientPort: devPort,
      protocol: 'ws'
    },
    watch: {
      usePolling: true
    }
  }
})
