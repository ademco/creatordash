import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // Recharts and Apollo Client make one ~230 KB (gzipped) bundle. That is fine
    // for a single-page dashboard, so raise the warning limit instead of
    // splitting the code into chunks it would always load together anyway.
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    // In development the API runs separately on port 4000. Proxying /graphql
    // makes the browser see one origin, so there is no CORS setup, and the
    // code uses the same relative URL it uses in production.
    proxy: {
      '/graphql': 'http://localhost:4000',
    },
  },
});
