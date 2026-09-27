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
      // `conditions: ["import"]` is what makes `@2enapps/ui` resolve. That
      // package's `exports` map declares `"." : { "import": "./dist/index.js" }`
      // with no `require` and no `default`, and the resolver runs in CommonJS
      // mode, so without this every module reports its UI import as unresolved
      // even though webpack builds it. Adding `"default"` alongside it covers
      // packages that publish the other shape.
      //
      // This needs `eslint-import-resolver-node@^0.4.0`, forced by the
      // `overrides` block in package.json — the resolver 0.3.x that
      // eslint-plugin-import depends on does not understand subpath `exports`
      // at all, so `@2enapps/ui/styles.css` is unresolved there too.
      node: {
        extensions: [".js", ".mjs", ".cjs", ".vue", ".css"],
        conditions: ["import", "default"]
      }
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
