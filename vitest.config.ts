import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    globals: false,
    // Run each file in its own isolated worker so vi.mock() state doesn't bleed
    pool: "forks",
    poolOptions: {
      forks: {
        isolate: true,
      },
    },
  },
  resolve: {
    // Strip .js extension aliases so TypeScript source files resolve correctly
    // under vitest (which uses vite's resolver, not tsc's NodeNext)
    alias: [
      {
        find: /^(\.{1,2}\/.+)\.js$/,
        replacement: "$1",
      },
    ],
  },
});
