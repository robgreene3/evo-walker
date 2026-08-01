import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@evowalker/core": fileURLToPath(
        new URL("../../packages/core/src/index.ts", import.meta.url),
      ),
      "@evowalker/sim": fileURLToPath(
        new URL("../../packages/sim/src/index.ts", import.meta.url),
      ),
      "@evowalker/worker/protocol": fileURLToPath(
        new URL("../../packages/worker/src/protocol.ts", import.meta.url),
      ),
      "@evowalker/worker": fileURLToPath(
        new URL("../../packages/worker/src/index.ts", import.meta.url),
      ),
    },
  },
  build: {
    sourcemap: true,
  },
  worker: {
    format: "es",
  },
});
