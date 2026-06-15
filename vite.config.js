import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'firebase', 'recharts', 'qrcode.react', 'html2canvas', 'jspdf']
  }
})
