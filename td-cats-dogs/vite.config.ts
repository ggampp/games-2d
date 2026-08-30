import { defineConfig } from "vite";
import { createReadStream, cpSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const KIT = resolve(__dirname, "free-cartoon-cat-defense-game-asset-kit");
function serveKit(req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) {
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = normalize(join(KIT, rel));
  if (!file.startsWith(KIT) || !existsSync(file) || !statSync(file).isFile()) {
    next();
    return;
  }
  res.setHeader("Content-Type", MIME[extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res as NodeJS.WritableStream);
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".json": "application/json",
  ".atlas": "text/plain",
  ".txt": "text/plain",
};

export default defineConfig({
  server: {
    port: 3000,
    open: false,
    host: "127.0.0.1",
    fs: { allow: [resolve(__dirname)] },
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: "serve-kit-in-place",
      configureServer(server) {
        server.middlewares.use("/kit", serveKit);
      },
      configurePreview(server) {
        server.middlewares.use("/kit", serveKit);
      },
      closeBundle() {
        const dest = resolve(__dirname, "dist", "kit");
        cpSync(KIT, dest, { recursive: true });
      },
    },
  ],
});
