import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves tsconfig `paths` natively, so the vite-tsconfig-paths plugin is not needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: true,
  },
});
