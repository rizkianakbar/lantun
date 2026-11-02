import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
        },
      ],
    },
  },
  {
    // Tool configs require a default export.
    files: ["**/*.config.{js,ts,mjs}"],
    rules: { "no-restricted-syntax": "off" },
  },
);
