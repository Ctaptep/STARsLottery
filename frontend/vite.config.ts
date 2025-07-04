import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.app', 'starslottery-fronend-production.up.railway.app'],
    port: 5173,
  },
  plugins: [react()]
});
