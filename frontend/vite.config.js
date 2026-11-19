import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Port 5173 must match CORS_ORIGIN in the root .env (strictPort fails instead of moving).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true }
});
