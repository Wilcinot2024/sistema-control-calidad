
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()], // Habilita React en Vite.
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // Servidor Django.
        changeOrigin: true, // Ajusta el origen de la petición.
      },
    },
  },
});
