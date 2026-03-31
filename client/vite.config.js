import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 모든 IP 주소에서 수신
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001', // 백엔드 주소로 내부 포워딩 (CORS 우회)
        changeOrigin: true
      }
    }
  }
})
