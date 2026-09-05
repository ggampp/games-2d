import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 3001,
    open: false,
    host: "127.0.0.1",
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
});
