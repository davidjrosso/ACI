import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Territorio — Campaña",
        short_name: "Territorio",
        description: "Gestión de campaña municipal: vecinos, timbreo, reclamos y agenda",
        lang: "es-AR",
        start_url: "/",
        display: "standalone",
        background_color: "#f7f7f5",
        theme_color: "#0f766e",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
    }),
  ],
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } },
  build: { chunkSizeWarningLimit: 900 },
});
