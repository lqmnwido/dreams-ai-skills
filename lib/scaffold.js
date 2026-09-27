"use strict";

/**
 * Scaffolding a new module's two repositories.
 *
 * A new module is never one repository. It is `<slug>_fe` — the federated Vue
 * remote the Shell imports — and `<slug>_be` — the Spring Boot service that
 * module calls, with its own environment, its own port and its own MinIO bucket.
 * The names, the ports, the bucket and the Java package all derive from one
 * answer (`MODULE_SLUG`), because a bucket called `module-demo` and a repository
 * called `module_demo_be` can only be kept in step by generating both from the
 * same value.
 *
 * What this module produces is a **compilable, lintable, honest skeleton**, not
 * a pretend product:
 *
 *   - federation config copied from the shape the platform actually ships;
 *   - a Spring Boot service built as Controller → Service → Storage port →
 *     MinIO adapter, with records, constructor injection and a global exception
 *     handler — the patterns `09-backend/SPRING-BOOT.md` mandates;
 *   - `.env` files that are the module's own, so nothing is read from the Shell;
 *   - formatter and linter configuration present from the first commit, because
 *     a style rule added after 5,000 lines is a merge conflict.
 *
 * Nothing here overwrites. `bin/install.js` writes each planned file with the
 * same rules the governance tree uses: keep, or back up with `--force`.
 */

const fs = require("fs");
const path = require("path");

const { render } = require("./render");
const { titleCase, slugify } = require("./naming");
const readme = require("./readme");

const TEMPLATES_DIR = path.join(__dirname, "..", "templates", "scaffold");

const KINDS = { frontend: "fe", backend: "be" };

function collect(kind) {
  const root = path.join(TEMPLATES_DIR, KINDS[kind] || kind);
  const files = {};
  if (!fs.existsSync(root)) return files;

  const walk = (dir, prefix = "") => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else files[rel] = fs.readFileSync(full, "utf8");
    }
  };

  walk(root);
  return files;
}

/* ------------------------------------------------------------------ */
/* Generated snippets                                                  */
/* ------------------------------------------------------------------ */

function submodulesOf(context) {
  return Array.isArray(context.SUBMODULES) ? context.SUBMODULES.filter(Boolean) : [];
}

/**
 * A page's human title. `program/senarai-program` is a path — a folder and a
 * file — and the folder is an implementation detail. Showing it as a title
 * produces "Program/senarai Program", which is a URL wearing a label.
 */
function pageLabel(submodule) {
  const segments = String(submodule || "").split("/").filter(Boolean);
  return titleCase(segments[segments.length - 1] || submodule || "");
}

/**
 * The `exposes` block.
 *
 * `./metadata` first, then one page key per sub-module. The key and the target
 * are the same string with `./src/` and `.vue` applied — that identity is the
 * whole federation contract, so it is generated once and used on both sides.
 */
function exposesSnippet(context) {
  const lines = ['          "./metadata": "./src/metadata.js"'];
  for (const sub of submodulesOf(context)) {
    lines[lines.length - 1] += ",";
    lines.push(`          "./views/${sub}": "./src/views/${sub}.vue"`);
  }
  return lines.join("\n");
}

/** The preview router's route table, one entry per page this remote exposes. */
function routesSnippet(context) {
  const subs = submodulesOf(context);
  const prefix = context.ROUTE_PREFIX || `/${context.MODULE_NAME || ""}`;
  const display = context.MODULE_DISPLAY || context.MODULE_NAME || "";
  const entries = [];

  // Every object and array here ends in a trailing comma, and the `component`
  // property ends in one too. The generated `src/preview/router.js` is checked by
  // `npm run verify` — the command the generated README tells the reader to run —
  // and `.prettierrc.json` sets `trailingComma: "all"`. Emitting `},` without the
  // comma on the last property is what made a freshly scaffolded module fail its
  // own gate while the installer and `mvn verify` both looked healthy.
  const entry = (path, name, title, view) =>
    [
      "  {",
      `    path: ${JSON.stringify(path)},`,
      `    name: ${JSON.stringify(name)},`,
      `    meta: { title: ${JSON.stringify(title)} },`,
      `    component: () => import(${JSON.stringify(view)}),`,
      "  },"
    ].join("\n");

  if (subs.length) {
    for (const sub of subs) {
      entries.push(
        entry(
          joinRoute(prefix, sub),
          [context.MODULE_NAME, slugify(sub)].filter(Boolean).join("-"),
          `${display} — ${pageLabel(sub)}`,
          `../views/${sub}.vue`
        )
      );
    }
  } else {
    entries.push(
      entry(prefix, `${context.MODULE_NAME || "module"}-home`, display, "../views/home.vue")
    );
  }

  entries.push(`  { path: "/", redirect: ${JSON.stringify(subs.length ? joinRoute(prefix, subs[0]) : prefix)} },`);
  return entries.join("\n");
}

function joinRoute(prefix, sub) {
  return `${prefix}/${sub}`.replace(/\/{2,}/g, "/");
}

/**
 * The shared UI dependency line, present only when the repository actually has
 * one. An `n/a` answer must not become a package.json that cannot install.
 */
function uiDependencySnippet(context) {
  const dep = context.UI_DEPENDENCY;
  if (!dep || dep === "n/a") return "";
  return `    "@2enapps/ui": ${JSON.stringify(dep)},`;
}

function uiImportSnippet(context) {
  const dep = context.UI_DEPENDENCY;
  if (!dep || dep === "n/a") return "";
  return [`import * as UI from "@2enapps/ui";`, `import "@2enapps/ui/styles.css";`].join("\n");
}

function uiUseSnippet(context) {
  const dep = context.UI_DEPENDENCY;
  if (!dep || dep === "n/a") return "";
  return `app.use(UI);`;
}

function snippets(context) {
  return {
    __EXPOSES__: exposesSnippet(context),
    __ROUTES__: routesSnippet(context),
    __UI_DEP__: uiDependencySnippet(context),
    __UI_IMPORT__: uiImportSnippet(context),
    __UI_USE__: uiUseSnippet(context),
    __ROUTES_BLOCK__: readme.render("routes", routesFor(context)),
    __APIS_BLOCK__: readme.render("api", apisFor(context))
  };
}

/* ------------------------------------------------------------------ */
/* The tables a scaffolded README carries                              */
/* ------------------------------------------------------------------ */

/** Routes a freshly scaffolded frontend exposes, before a router exists. */
function routesFor(context) {
  const subs = submodulesOf(context);
  const prefix = context.ROUTE_PREFIX || `/${context.MODULE_NAME || ""}`;
  const name = context.MODULE_NAME || "";

  if (!subs.length) {
    return [{ route: prefix, name, view: "src/views/home.vue" }];
  }
  return subs.map((sub) => ({
    route: joinRoute(prefix, sub),
    name: [name, slugify(sub)].filter(Boolean).join("-"),
    view: `src/views/${sub}.vue`
  }));
}

/** Endpoints the scaffolded Spring Boot service exposes. */
function apisFor(context) {
  const base = `/api/${context.MODULE_SLUG || context.MODULE_NAME || "module"}`;
  return [
    { method: "POST", endpoint: `${base}/documents`, handler: "DocumentController.upload" },
    { method: "GET", endpoint: `${base}/documents/{key}`, handler: "DocumentController.resolve" },
    { method: "DELETE", endpoint: `${base}/documents/{key}`, handler: "DocumentController.remove" }
  ];
}

/* ------------------------------------------------------------------ */
/* What a level adds to the generated prose                            */
/* ------------------------------------------------------------------ */

/** The one CI workflow this package ships, for the frontend half. */
const FE_CI_WORKFLOW = `name: verify

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm run verify
`;

/** The one CI workflow this package ships, for the backend half. */
const BE_CI_WORKFLOW = `name: verify

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - run: mvn --batch-mode verify
`;

/** The `mvn verify` line, and only what it is true about at this level. */
function verifyLineSnippet(level) {
  return level === "economy"
    ? "mvn verify                 # format + checkstyle + spotbugs\n"
    : "mvn verify                 # format + checkstyle + spotbugs + tests\n";
}

/** The prose that explains what `mvn verify` fails on. */
function verifyClauseSnippet(level) {
  return level === "economy"
    ? "It fails on formatting, on structure and on analysis — in that order, so " +
      "the first failure is always the cheapest one to fix.\n"
    : "It fails on formatting, on structure, on analysis and on tests — in that " +
      "order, so the first failure is always the cheapest one to fix.\n";
}

/** Maven, pinned to the version the governance documents name. */
const BE_CI_PROPERTIES = `    <!-- Versions the platform pins, so a workflow cannot drift onto a
         different major than the one 05-development/TOOLS.md documents. -->
    <pin.maven>3.9.9</pin.maven>
    <pin.ci.actions.checkout>4</pin.ci.actions.checkout>
    <pin.ci.actions.setup-java>4</pin.ci.actions.setup-java>
    <pin.ci.actions.setup-node>4</pin.ci.actions.setup-node>
`;

/**
 * What this repository is, recorded where a build log can be read against it.
 *
 * Only at Full. The version, the slug and the date are the three values that
 * explain *which* install produced an artifact; the rest of the inventory lives
 * in `.docs/install.json`, which a build never reads.
 */
function inventorySnippet(context) {
  const rows = [
    ["Module", context.MODULE_DISPLAY || context.MODULE_NAME || "—"],
    ["Slug", context.MODULE_SLUG || "—"],
    ["Version", context.MODULE_VERSION || "0.1.0"],
    ["Backend port", context.BACKEND_PORT || "—"],
    ["Object-storage bucket", context.BUCKET || "—"],
    ["Governance", ".docs/project-governance/ (in the workspace root)"],
    ["Scaffolded", context.INSTALL_DATE || "—"],
    ["Scaffold level", "Full"],
    ["CI", "on push to main and on every pull request"]
  ];
  return [
    "## Inventory",
    "",
    "Written by the installer this repository was scaffolded from. Every value below",
    "is generated — change the install, not this table.",
    "",
    "| Value | |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | \`${value}\` |`)
  ].join("\n");
}

/** Every `__DIRECTIVE__` the templates may use, resolved for one level. */
function directivesFor(level, context) {
  return {
    FE_CI_WORKFLOW: level === "full" ? FE_CI_WORKFLOW : "",
    BE_CI_WORKFLOW: level === "full" ? BE_CI_WORKFLOW : "",
    VERIFY_LINE: verifyLineSnippet(level),
    VERIFY_CLAUSE: verifyClauseSnippet(level),
    BE_TEST_DEPENDENCY: level === "economy" ? "" : beTestDependency(),
    BE_SPOTLESS_TEST_INCLUDE: level === "economy" ? "" : "              <include>src/test/java/**/*.java</include>\n",
    BE_CHECKSTYLE_TEST_INCLUDE: level === "economy" ? "" : "          <includeTestSourceDirectory>true</includeTestSourceDirectory>\n",
    BE_CHECKSTYLE_TEST_SOURCE: level === "economy" ? "" : "            <sourceDirectory>${project.build.testSourceDirectory}</sourceDirectory>\n",
    BE_CI_PROPERTIES: level === "full" ? BE_CI_PROPERTIES : "",
    INVENTORY: level === "full" ? inventorySnippet(context) : ""
  };
}

function beTestDependency() {
  return [
    "    <dependency>",
    "      <groupId>org.springframework.boot</groupId>",
    "      <artifactId>spring-boot-starter-test</artifactId>",
    "      <scope>test</scope>",
    "    </dependency>",
    ""
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Planning                                                            */
/* ------------------------------------------------------------------ */

/**
 * A template path may contain `__SUB__`, which stands for one page per
 * sub-module. Expanding it here — rather than inventing a conditional syntax in
 * the renderer — keeps the renderer exactly as simple as the governance tree
 * needs it to be, and means "one file per page" is visible in the file list.
 */
function expand(relativePath, context) {
  if (!relativePath.includes("__SUB__")) return [{ relativePath, context }];

  const subs = submodulesOf(context);
  const targets = subs.length ? subs : ["home"];
  return targets.map((sub) => ({
    relativePath: relativePath.replace("__SUB__", sub),
    context: { ...context, SUBMODULE: sub, SUBMODULE_HEADING: pageLabel(sub) }
  }));
}

/**
 * Template filenames that must differ from the file they produce.
 *
 * Two names cannot travel to the package. A file called `.gitignore` is never
 * written into an npm tarball, so a published install would scaffold a
 * repository with no `.gitignore` at all and nothing to say so. A file called
 * `.env` sitting beside the generated repository's own `.gitignore` is matched
 * by that file's `.env` line, so git would not carry it either.
 *
 * Both failures are invisible locally — the file is on disk here, so the
 * scaffold works — and appear only on the first install from a published
 * package, which is the only install most people ever run.
 */
const PATH_RENAMES = {
  "env.template": ".env",
  "gitignore": ".gitignore"
};

/**
 * What each review level adds to the scaffold, and what it takes away.
 *
 * These are matched against the *template* path, before rendering, so a rule
 * reads the same whatever the module is called. Each one is a thing a developer
 * would otherwise add in the first week; a level is how much of the first week
 * the installer does for them.
 *
 * The pom and the generated READMEs follow the same level, so nothing in a
 * scaffolded repository claims something that is not in it — a `mvn verify` line
 * that promises tests in a repository that has none is worse than no README.
 */
const ECONOMY_EXCLUDED = [
  {
    test: (relative) => /^src\/test\//.test(relative),
    why: "the test sources"
  },
  {
    test: (relative) => relative === ".editorconfig",
    why: ".editorconfig"
  }
];

const FULL_ONLY = [
  {
    test: (relative) => /^\.github\//.test(relative),
    why: "the CI workflow"
  },
  {
    test: (relative) => relative === "CHANGELOG.md",
    why: "CHANGELOG.md"
  }
];

function exclusionFor(level, relative) {
  if (level === "full") return null;
  // Anything the Full level adds is absent below it, and anything the Economy
  // level trims is absent at it. Both lists apply to Recommended.
  const rules = level === "economy" ? [...ECONOMY_EXCLUDED, ...FULL_ONLY] : FULL_ONLY;
  const hit = rules.find((rule) => rule.test(relative));
  return hit ? hit.why : null;
}

/**
 * A level, normalised to one of the three the review gate offers.
 *
 * Anything unrecognised — an old `install.json`, a hand-edited `scaffold` block,
 * a typo in a flag — is the default rather than an error, because a scaffold
 * that refuses to run over a cosmetic mistake in a configuration file is a worse
 * outcome than the default scope.
 */
function levelOf(value) {
  const text = String(value == null ? "" : value).trim().toLowerCase();
  if (["1", "recommended"].includes(text)) return "recommended";
  if (["2", "economy"].includes(text)) return "economy";
  if (["3", "full"].includes(text)) return "full";
  return "recommended";
}

const DIRECTIVE = /^[ \t]*__([A-Z_]+)__[ \t]*\r?\n?/gm;

/**
 * Substitute `__NAME__` directives in a template body.
 *
 * The governance renderer substitutes `{{TOKEN}}`; the scaffold needs a second
 * mechanism because some of what it writes is *decided here* — whether a
 * repository has tests at all — rather than derived from an answer. A directive
 * owns its whole line, trailing newline included, so a multi-line value slots in
 * without leaving a blank line where the marker was.
 *
 * A directive that is not provided is an error rather than an empty string: a
 * typo would otherwise ship as a file containing `__NOPE__`, and the only place
 * it would ever be noticed is somebody's first `mvn verify`.
 */
function applyDirectives(body, values = {}) {
  const trailingNewline = /\n$/.test(body);
  const out = body.replace(DIRECTIVE, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(values, name)) {
      throw new Error(`scaffold template uses an unknown directive __${name}__`);
    }
    return values[name] === undefined || values[name] === null ? "" : String(values[name]);
  });
  // A directive at the end of a file eats the file's final newline; restoring it
  // is cheaper than every snippet having to know it is last.
  return trailingNewline && !/\n$/.test(out) ? `${out}\n` : out;
}

/**
 * The files `--parts` asks for, at a given review level.
 *
 * The `plan` field exists so the review gate can describe the choice before it
 * is made: three cheap renders — the templates are read from disk, and the
 * output is a string each — and the person answering `1`, `2` or `3` sees
 * "38 files" or "44 files" instead of a promise.
 */
/**
 * The complete list of files `--parts` asks for, relative to `cwd`, at one
 * review level.
 *
 * Every path is rendered, and a path that still contains a token afterwards is
 * dropped and reported: writing a file literally named
 * `{{MODULE_CLASS}}Application.java` would create a repository that does not
 * compile and that no search would find again.
 */
function plan(rawContext, { level = "recommended", describe = false } = {}) {
  // `PKG_PATH` is the only derived value the file paths need that the render
  // context does not already carry: a Java package is a dotted name on the
  // classpath and a directory chain on disk, and deriving it here keeps
  // `lib/render.js` free of path-awareness.
  const context = {
    ...rawContext,
    PKG_PATH: String(rawContext.BASE_PACKAGE || "com.dreams.module").replace(/\./g, "/")
  };
  const chosen = levelOf(level);

  const parts = context.SCAFFOLD || "docs";
  const wanted = [];
  if (parts === "both" || parts === "frontend") wanted.push("frontend");
  if (parts === "both" || parts === "backend") wanted.push("backend");

  const shared = snippets(context);
  const files = [];
  const unresolvedPaths = [];
  const unresolvedTokens = new Set();
  const skipped = [];

  for (const kind of wanted) {
    const repo = kind === "frontend" ? context.FRONTEND_REPO : context.BACKEND_REPO;
    if (!repo) {
      unresolvedPaths.push(`${kind}: repository name is unresolved`);
      continue;
    }

    const templates = collect(kind);
    for (const [relative, source] of Object.entries(templates)) {
      const reason = exclusionFor(chosen, relative);
      if (reason) {
        skipped.push(`${repo}/${relative} — not written at ${chosen} (${reason})`);
        continue;
      }

      for (const variant of expand(relative, context)) {
        const renderedPath = render(variant.relativePath, variant.context);
        if (renderedPath.unresolved.length) {
          unresolvedPaths.push(`${relative} → {{${renderedPath.unresolved.join("}}, {{")}}}`);
          continue;
        }

        // A directive is replaced before the token pass, so `{{ROUTE_PREFIX}}`
        // inside a generated route becomes a real path in one pass. An empty
        // directive leaves one blank line, which every formatter accepts.
        let body = source;
        for (const [directive, value] of Object.entries(shared)) {
          if (body.includes(directive)) body = body.split(directive).join(value);
        }
        body = applyDirectives(body, directivesFor(chosen, context));
        // A directive on the first line that expands to nothing would leave the
        // file starting with a blank line, which `prettier --check` rejects on
        // the very first run.
        body = body.replace(/^[ \t]*\n+/, "");

        const rendered = render(body, variant.context);
        for (const token of rendered.unresolved) unresolvedTokens.add(token);

        // Renamed last, so a template whose *name* carries a token still has it
        // resolved before the substitution.
        const basename = renderedPath.text.split("/").pop();
        const output = PATH_RENAMES[basename]
          ? renderedPath.text.replace(basename, PATH_RENAMES[basename])
          : renderedPath.text;

        files.push({
          kind,
          repository: repo,
          relative: `${repo}/${output}`,
          content: rendered.text
        });
      }
    }
  }

  return {
    parts,
    level: chosen,
    files,
    repositories: wanted.map((kind) => (kind === "frontend" ? context.FRONTEND_REPO : context.BACKEND_REPO)).filter(Boolean),
    unresolvedPaths,
    unresolvedTokens: [...unresolvedTokens].sort(),
    skipped,
    ...(describe ? { plan: describeScopes(context) } : {})
  };
}

/**
 * The file count each level would produce, for the review gate to show.
 *
 * `parts: "docs"` writes no source at all, so all three levels agree — and the
 * gate is told so, rather than offering a choice between three identical
 * numbers.
 */
function describeScopes(context) {
  const scopes = {};
  for (const level of ["economy", "recommended", "full"]) {
    const scoped = plan(context, { level });
    const byRepository = {};
    for (const file of scoped.files) {
      if (!byRepository[file.repository]) byRepository[file.repository] = 0;
      byRepository[file.repository] += 1;
    }
    scopes[level] = { files: scoped.files.length, repositories: byRepository };
  }
  return scopes;
}

module.exports = {
  TEMPLATES_DIR,
  collect,
  plan,
  describeScopes,
  levelOf,
  exclusionFor,
  applyDirectives,
  expand,
  exposesSnippet,
  routesSnippet,
  routesFor,
  apisFor,
  snippets
};
