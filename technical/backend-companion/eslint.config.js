const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsParser = require("@typescript-eslint/parser");

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  __dirname: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  require: "readonly",
  module: "readonly",
  exports: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Buffer: "readonly"
};

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      globals: nodeGlobals
    }
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest"
      },
      globals: nodeGlobals
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ]
    }
  }
];
