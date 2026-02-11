import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 拖拽排序库
          if (id.includes('@dnd-kit')) return 'dnd-kit';
          // 图标库
          if (id.includes('lucide-react')) return 'lucide';
        }
      }
    }
  }
});
