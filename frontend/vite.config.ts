import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: { "/api": { target: process.env.API_PROXY_TARGET || "http://127.0.0.1:3001", changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, "") } },
  },
  preview: {
    proxy: { "/api": { target: process.env.API_PROXY_TARGET || "http://127.0.0.1:3001", changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, "") } },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules\/(react|react-dom|react-router|scheduler)\//,
            },
            {
              name: "ui-vendor",
              test: /node_modules\/(@base-ui|@floating-ui)\//,
            },
          ],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
