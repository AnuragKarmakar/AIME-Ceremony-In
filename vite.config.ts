// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Vite only injects VITE_-prefixed vars into client code; server functions read
// process.env, which Vite leaves untouched. Merge .env into it here so secrets
// like GEMINI_API_KEY are available to server functions in local dev.
// (loadEnv gives real environment variables priority over .env file values.)
Object.assign(
  process.env,
  loadEnv(process.env.NODE_ENV === "production" ? "production" : "development", process.cwd(), ""),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Respect an externally assigned PORT (e.g. from preview tooling); the Lovable
  // config falls back to 8080 when unset. Ignored inside the Lovable sandbox,
  // which forces 8080 regardless.
  vite: process.env.PORT ? { server: { port: Number(process.env.PORT) } } : undefined,
  // Plain Node server output instead of the cloudflare-module default —
  // deployed target is AWS App Runner (Node.js source build), which runs
  // `node .output/server/index.mjs` directly, not a Cloudflare Worker.
  nitro: { preset: "node-server" },
});
