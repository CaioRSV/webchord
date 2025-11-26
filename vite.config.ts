import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    exclude: ['rust-dsp'],
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure worklet files are handled correctly
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.js') && assetInfo.name.includes('processor')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});

