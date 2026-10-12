import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Relative paths so the build works inside the YouTube Playables iframe
  build: {
    target: 'esnext',
    assetsInlineLimit: 10000000, // Inline fonts so the build is fully self-contained
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 3001,
    open: true,
  },
});
