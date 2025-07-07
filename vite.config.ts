import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/project44-oauth': {
        target: 'https://na12.api.project44.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/project44-oauth/, ''),
        headers: {
          'Host': 'na12.api.project44.com'
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Remove Origin header to bypass CORS restrictions
            proxyReq.removeHeader('origin');
          });
          proxy.on('error', (err, _req, res) => {
            console.error('Proxy error for /api/project44-oauth:', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error occurred' }));
            }
          });
        }
      },
      '/api/project44': {
        target: 'https://na12.api.project44.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/project44/, ''),
        headers: {
          'Host': 'na12.api.project44.com'
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Remove Origin header to bypass CORS restrictions
            proxyReq.removeHeader('origin');
          });
          proxy.on('error', (err, _req, res) => {
            console.error('Proxy error for /api/project44:', err.message);
            if (!res.headersSent) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Proxy error occurred' }));
            }
          });
        }
      }
    }
  }
})