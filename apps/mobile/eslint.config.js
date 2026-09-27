// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["**/dist/**", "**/build/**", "**/generated/**", "**/coverage/**", "**/.expo/**", "node_modules/**", "**/.venv/**", "**/scratch/**", "**/scripts/**", "**/.agents/**", "**/__tests__/**"],
  }
]);
