import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.browser,
        // CJS compat (used in /* istanbul ignore next */ export blocks)
        module: "readonly",
        // Runtime-optional libraries loaded on demand
        hljs: "readonly",
        MathJax: "readonly",
        DOMPurify: "readonly",
        L: "readonly",          // Leaflet
        mermaid: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "curly": ["error", "multi-line"],
      "no-throw-literal": "error",
      // Relax rules that conflict with the parser's switch/case style
      "no-case-declarations": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "examples/", "dev/", "tools/", "tests/", "test-results/", "exp-bd/"],
  },
];
