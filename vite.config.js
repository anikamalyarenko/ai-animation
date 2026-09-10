import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const entry = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // The AuroraBackground preview, at the site root.
        main: entry('./index.html'),
        // The ProcessFlow embed, moved off the root but still served.
        processFlow: entry('./process-flow.html'),
      },
    },
  },
});
