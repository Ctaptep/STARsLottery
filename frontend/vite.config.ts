import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.app', 'starslottery-fronend-production.up.railway.app'],
    
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 8080,
    
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  plugins: [
    react(),
    nodePolyfills(),
  ],
});
