import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
    { ignores: ["dist", ".output", "node_modules", ".tanstack", "routeTree.gen.ts"] },
    { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
            "@typescript-eslint/consistent-type-definitions": ["error", "type"]
        }
    },
    {
        // Test files mock third-party ORM builder chains whose generic types
        // aren't worth reproducing structurally — `any` is the pragmatic
        // boundary here, not a real type gap.
        files: ["**/*.test.{ts,tsx}"],
        rules: {
            "@typescript-eslint/no-explicit-any": "off"
        }
    }
];
