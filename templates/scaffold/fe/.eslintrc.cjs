/**
 * Lint and format for this repository.
 *
 * `npm run verify` is the gate: prettier first (it only rewrites), then eslint
 * (it only reports). The two are kept compatible by `eslint-config-prettier`,
 * which is last in `extends` so formatting rules never fight each other.
 *
 * `02-governance/ANTI-SLOP.md` is what these rules are *for* — see the
 * "Enforcement" section there for the mapping from rule to offence.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  extends: [
    "eslint:recommended",
    "plugin:vue/vue3-recommended",
    "plugin:import/recommended",
    "prettier"
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  settings: {
    "import/resolver": {
      node: { extensions: [".js", ".mjs", ".cjs", ".vue"] }
    }
  },
  rules: {
    // The preview entry renders real pages without a Shell present; a bare
    // `console.log` left in a view is still slop, so only warn/error survive.
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-debugger": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    // Duplicate block-level code is the single strongest signal of a paste job.
    "no-duplicate-imports": "error",
    "prefer-const": "error",
    "eqeqeq": ["error", "smart"],
    "no-var": "error",
    // A component name must describe a thing, not a folder layout.
    "vue/multi-word-component-names": "off",
    "vue/no-mutating-props": "error",
    "vue/require-default-prop": "error",
    "vue/attributes-order": "warn",
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
        "newlines-between": "always",
        "alphabetize": { order: "asc", caseInsensitive: true }
      }
    ],
    "import/no-unresolved": "warn"
  },
  overrides: [
    {
      files: ["*.cjs", "*.config.js"],
      rules: {
        "import/no-unresolved": "off"
      }
    }
  ]
};
