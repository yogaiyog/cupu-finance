import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('dexie')) return 'vendor-db';
            if (id.includes('@capacitor')) return 'vendor-capacitor';
            if (id.includes('lucide-solid')) return 'vendor-icons';
            if (id.includes('solid-js')) return 'vendor-solid';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  // @ts-ignore
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
