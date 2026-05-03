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
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Keep manual chunks ONLY for libraries that are genuinely
        // self-contained. Anything that touches d3 transitively
        // (reactflow, recharts) or shares utilities (three / drei)
        // goes into the default vendor chunk — splitting those
        // produced a circular chunk graph that hit TDZ at runtime
        // on the deployed Pages bundle ("Cannot access 'ui' before
        // initialization" in reactflow-*.js).
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined;
          // Editor — heavy and fully isolated.
          if (/[\\/]@monaco-editor[\\/]/.test(id)) return 'monaco';
          // Animations — used everywhere, isolated dep.
          if (/[\\/]framer-motion[\\/]/.test(id)) return 'motion';
          // Markdown rendering pipeline (react-markdown + unified
          // ecosystem). Lots of small files, one chunk.
          if (
            /[\\/]react-markdown[\\/]/.test(id) ||
            /[\\/]remark-/.test(id) ||
            /[\\/]rehype-/.test(id) ||
            /[\\/]mdast-/.test(id) ||
            /[\\/]hast-/.test(id) ||
            /[\\/]micromark/.test(id) ||
            /[\\/]unified[\\/]/.test(id) ||
            /[\\/]vfile[\\/]/.test(id) ||
            /[\\/]property-information[\\/]/.test(id) ||
            /[\\/]decode-named-character-reference[\\/]/.test(id) ||
            /[\\/]character-entities/.test(id) ||
            /-separated-tokens/.test(id)
          ) {
            return 'markdown';
          }
          return undefined; // everything else → default vendor
        },
      },
    },
  },
});
