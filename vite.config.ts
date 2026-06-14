import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Same-origin proxy to ComEd (the ServletFeed endpoint sends no CORS headers).
// Used by both `vite` (dev) and `vite preview`; production uses server.js.
const comedProxy = {
  "/comed": {
    target: "https://hourlypricing.comed.com",
    changeOrigin: true,
    secure: true,
    rewrite: (p: string) => p.replace(/^\/comed/, ""),
  },
};

export default defineConfig({
  resolve: {
    // The shared ComEd/pricing logic has a single source of truth at
    // mobile/src/lib (so the Expo app keeps it inside its own tree). The web app
    // reaches into it via `@/lib/*`; everything else `@/*` is the web app's own
    // src. Order matters — first match wins.
    alias: [
      {
        find: /^@\/lib$/,
        replacement: path.resolve(__dirname, "mobile/src/lib/index.ts"),
      },
      {
        find: /^@\/lib\//,
        replacement: path.resolve(__dirname, "mobile/src/lib") + "/",
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "OffPeak — ComEd Hourly Pricing",
        short_name: "OffPeak",
        description:
          "Real-time ComEd hourly electricity pricing, trends, and price alerts.",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Cache the app shell only; ComEd API responses use NetworkFirst.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === "https://hourlypricing.comed.com",
            handler: "NetworkFirst",
            options: {
              cacheName: "comed-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: true, proxy: comedProxy },
  preview: { port: 4173, proxy: comedProxy },
});
