// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/project44-oauth": {
        target: "https://na12.api.project44.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/project44-oauth/, ""),
        headers: {
          "Host": "na12.api.project44.com"
        },
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("origin");
          });
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error for /api/project44-oauth:", err.message);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy error occurred" }));
            }
          });
        }
      },
      "/api/project44": {
        target: "https://na12.api.project44.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/project44/, ""),
        headers: {
          "Host": "na12.api.project44.com"
        },
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, _req, _res) => {
            proxyReq.removeHeader("origin");
          });
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error for /api/project44:", err.message);
            if (!res.headersSent) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Proxy error occurred" }));
            }
          });
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3JlYWN0KCldLFxuICBzZXJ2ZXI6IHtcbiAgICBwcm94eToge1xuICAgICAgJy9hcGkvcHJvamVjdDQ0LW9hdXRoJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL25hMTIuYXBpLnByb2plY3Q0NC5jb20nLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9wcm9qZWN0NDQtb2F1dGgvLCAnJyksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnSG9zdCc6ICduYTEyLmFwaS5wcm9qZWN0NDQuY29tJ1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBPcmlnaW4gaGVhZGVyIHRvIGJ5cGFzcyBDT1JTIHJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgcHJveHlSZXEucmVtb3ZlSGVhZGVyKCdvcmlnaW4nKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCBfcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb3h5IGVycm9yIGZvciAvYXBpL3Byb2plY3Q0NC1vYXV0aDonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdQcm94eSBlcnJvciBvY2N1cnJlZCcgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgJy9hcGkvcHJvamVjdDQ0Jzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwczovL25hMTIuYXBpLnByb2plY3Q0NC5jb20nLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9wcm9qZWN0NDQvLCAnJyksXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnSG9zdCc6ICduYTEyLmFwaS5wcm9qZWN0NDQuY29tJ1xuICAgICAgICB9LFxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBPcmlnaW4gaGVhZGVyIHRvIGJ5cGFzcyBDT1JTIHJlc3RyaWN0aW9uc1xuICAgICAgICAgICAgcHJveHlSZXEucmVtb3ZlSGVhZGVyKCdvcmlnaW4nKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCBfcmVxLCByZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1Byb3h5IGVycm9yIGZvciAvYXBpL3Byb2plY3Q0NDonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICBpZiAoIXJlcy5oZWFkZXJzU2VudCkge1xuICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdQcm94eSBlcnJvciBvY2N1cnJlZCcgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59KSJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBR2xCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixRQUFRO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCx3QkFBd0I7QUFBQSxRQUN0QixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsUUFDUixTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsMkJBQTJCLEVBQUU7QUFBQSxRQUM3RCxTQUFTO0FBQUEsVUFDUCxRQUFRO0FBQUEsUUFDVjtBQUFBLFFBQ0EsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUM5QixnQkFBTSxHQUFHLFlBQVksQ0FBQyxVQUFVLE1BQU0sU0FBUztBQUU3QyxxQkFBUyxhQUFhLFFBQVE7QUFBQSxVQUNoQyxDQUFDO0FBQ0QsZ0JBQU0sR0FBRyxTQUFTLENBQUMsS0FBSyxNQUFNLFFBQVE7QUFDcEMsb0JBQVEsTUFBTSx5Q0FBeUMsSUFBSSxPQUFPO0FBQ2xFLGdCQUFJLENBQUMsSUFBSSxhQUFhO0FBQ3BCLGtCQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQztBQUN6RCxrQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sdUJBQXVCLENBQUMsQ0FBQztBQUFBLFlBQzNEO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGtCQUFrQjtBQUFBLFFBQ2hCLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLFNBQVMsQ0FBQyxTQUFTLEtBQUssUUFBUSxxQkFBcUIsRUFBRTtBQUFBLFFBQ3ZELFNBQVM7QUFBQSxVQUNQLFFBQVE7QUFBQSxRQUNWO0FBQUEsUUFDQSxXQUFXLENBQUMsT0FBTyxhQUFhO0FBQzlCLGdCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsTUFBTSxTQUFTO0FBRTdDLHFCQUFTLGFBQWEsUUFBUTtBQUFBLFVBQ2hDLENBQUM7QUFDRCxnQkFBTSxHQUFHLFNBQVMsQ0FBQyxLQUFLLE1BQU0sUUFBUTtBQUNwQyxvQkFBUSxNQUFNLG1DQUFtQyxJQUFJLE9BQU87QUFDNUQsZ0JBQUksQ0FBQyxJQUFJLGFBQWE7QUFDcEIsa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGtCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyx1QkFBdUIsQ0FBQyxDQUFDO0FBQUEsWUFDM0Q7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
