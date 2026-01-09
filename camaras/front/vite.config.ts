import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Optimización de chunks para mejor caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'hls': ['hls.js'],
          'ui': ['lucide-react'],
        },
      },
    },
    // Generar sourcemaps solo en desarrollo
    sourcemap: false,
    // Minificación agresiva
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Quitar console.log en producción
        drop_debugger: true,
      },
    },
    // Tamaño de chunks
    chunkSizeWarningLimit: 1000,
  },
  // Servidor de desarrollo
  server: {
    host: true,
    port: 5173,
    cors: true,
  },
});

