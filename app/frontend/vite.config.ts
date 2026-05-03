import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `BASE_PATH` lets us deploy the static bundle to GitHub Pages at
// `/medallion-lab/` while keeping `/` for Docker / Railway / local dev.
// CI sets this; locally it's '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          monaco: ['@monaco-editor/react'],
          reactflow: ['reactflow'],
          charts: ['recharts', 'd3'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
