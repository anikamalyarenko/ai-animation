import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const entry = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The existing ProcessFlow embed.
        main: entry('./index.html'),
        // The AuroraBackground demo.
        aurora: entry('./aurora.html'),
      },
    },
  },
});
