import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@evowalker/core": fileURLToPath(
        new URL("./packages/core/src/index.ts", import.meta.url),
      ),
      "@evowalker/sim": fileURLToPath(
        new URL("./packages/sim/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["packages/**/*.benchmark.test.ts"],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
});
