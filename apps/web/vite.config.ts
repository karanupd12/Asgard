import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// In dev, the API, the chain RPC and the IPFS gateway are proxied so the app is same-origin
// (exactly like the nginx setup in Docker).
const API = process.env.API_URL ?? "http://localhost:8080";
const RPC = process.env.RPC_PROXY_URL ?? "http://localhost:8545";
const IPFS = process.env.IPFS_GATEWAY_URL ?? "http://localhost:8081";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": API,
      "/rpc": { target: RPC, rewrite: () => "/" },
      // changeOrigin: Kubo redirects Host "localhost" to subdomain gateways.
      "/ipfs": { target: IPFS, changeOrigin: true },
    },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks so app deploys don't bust the heavy web3 cache.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          web3: ["wagmi", "viem", "@tanstack/react-query"],
        },
      },
    },
  },
});
