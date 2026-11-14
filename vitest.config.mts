import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Demo history is written only where a test asks for it, and tests never call a model provider.
    env: { LAITURI_SEED: "off", LAITURI_AGENT_ENGINE: "scripted" },
    // Seeding a signed week of trade takes about two seconds alone; with every file running at once it can take longer.
    testTimeout: 20_000,
  },
});
