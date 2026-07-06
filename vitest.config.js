import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "path";

// Unit / integration test config (component + logic tests).
// End-to-end browser flows live in Playwright (see playwright.config.js).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,               // describe/it/expect without imports
    environment: "jsdom",        // DOM for React component tests
    setupFiles: ["./tests/unit/setup.js"],
    include: ["tests/unit/**/*.{test,spec}.{js,jsx}"],
    css: false,
    // Point the Supabase client at the MSW-mocked host during tests.
    env: {
      VITE_SUPABASE_URL: "https://bwjfglerixssibenkjse.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/lib/**", "src/entities/**", "src/api/**"],
    },
  },
});
