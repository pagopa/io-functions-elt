import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"]
  },
  test: {
    coverage: {
      exclude: [
        "dist",
        "__mocks__/**",
        "/node_modules",
        "*.js",
        "generated",
        "openapi",
        "eslint.config.mjs"
      ],
      reporter: ["lcov", "text"]
    },
    exclude: ["**/node_modules/**", "**/dist/**", "__mocks__/**"]
  }
});
