import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/fetchers/nominatim/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@cleardeed/schema": path.resolve(__dirname, "packages/schema/src/index.ts"),
    },
  },
});