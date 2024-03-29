module.exports = {
  "env": {
      "es6": true,
      "node": true
  },
  "ignorePatterns": [
      "node_modules",
      "generated",
      "**/__tests__/*",
      "**/__mocks__/*",
      "*.d.ts",
      "*.js",
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
      "project": "./tsconfig.json",
      "sourceType": "module"
  },
  "extends": [
      "@pagopa/eslint-config/strong",
  ],
  "rules": {}
};
