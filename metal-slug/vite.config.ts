import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
    host: "127.0.0.1",
    open: false,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
});
