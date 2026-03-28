import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/deployed-api": {
        target: "https://repo-zl06.onrender.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deployed-api/, "/api"),
        secure: true,
      },
      "/ml-api": {
        target: "https://sar-generator.onrender.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ml-api/, ""),
        secure: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
