import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['.ngrok-free.app'],
    port: 5173,
  },
  plugins: [react()]
});
