import pagopa from "@pagopa/eslint-config";

export default [
  ...pagopa,
  {
    ignores: [
      "node_modules",
      "generated",
      "dist",
      "docker/*",
      "**/__tests__/*",
      "**/__mocks__/*",
      "*.d.ts",
      "*.js"
    ]
  },
  {
    rules: {
      ...pagopa[2].rules,
      "vitest/no-conditional-expect": "off"
    }
  }
];
