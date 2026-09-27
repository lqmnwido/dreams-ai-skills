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

  if (subs.length) {
    for (const sub of subs) {
      entries.push([
        "  {",
        `    path: ${JSON.stringify(joinRoute(prefix, sub))},`,
        `    name: ${JSON.stringify([context.MODULE_NAME, slugify(sub)].filter(Boolean).join("-"))},`,
        `    meta: { title: ${JSON.stringify(`${display} — ${pageLabel(sub)}`)} },`,
        `    component: () => import(${JSON.stringify(`../views/${sub}.vue`)})`,
        "  }"
      ].join("\n"));
    }
  } else {
    entries.push([
      "  {",
      `    path: ${JSON.stringify(prefix)},`,
      `    name: ${JSON.stringify(`${context.MODULE_NAME || "module"}-home`)},`,
      `    meta: { title: ${JSON.stringify(display)} },`,
      "    component: () => import(\"../views/home.vue\")",
      "  }"
    ].join("\n"));
  }

  entries.push(`  { path: "/", redirect: ${JSON.stringify(subs.length ? joinRoute(prefix, subs[0]) : prefix)} }`);
  return entries.join(",\n");
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
 * The complete list of files `--parts` asks for, relative to `cwd`.
 *
 * Every path is rendered, and a path that still contains a token afterwards is
 * dropped and reported: writing a file literally named
 * `{{MODULE_CLASS}}Application.java` would create a repository that does not
 * compile and that no search would find again.
 */
function plan(rawContext) {
  // `PKG_PATH` is the only derived value the file paths need that the render
  // context does not already carry: a Java package is a dotted name on the
  // classpath and a directory chain on disk, and deriving it here keeps
  // `lib/render.js` free of path-awareness.
  const context = {
    ...rawContext,
    PKG_PATH: String(rawContext.BASE_PACKAGE || "com.dreams.module").replace(/\./g, "/")
  };

  const parts = context.SCAFFOLD || "docs";
  const wanted = [];
  if (parts === "both" || parts === "frontend") wanted.push("frontend");
  if (parts === "both" || parts === "backend") wanted.push("backend");

  const shared = snippets(context);
  const files = [];
  const unresolvedPaths = [];
  const unresolvedTokens = new Set();

  for (const kind of wanted) {
    const repo = kind === "frontend" ? context.FRONTEND_REPO : context.BACKEND_REPO;
    if (!repo) {
      unresolvedPaths.push(`${kind}: repository name is unresolved`);
      continue;
    }

    const templates = collect(kind);
    for (const [relative, source] of Object.entries(templates)) {
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
    files,
    repositories: wanted.map((kind) => (kind === "frontend" ? context.FRONTEND_REPO : context.BACKEND_REPO)).filter(Boolean),
    unresolvedPaths,
    unresolvedTokens: [...unresolvedTokens].sort()
  };
}

module.exports = {
  TEMPLATES_DIR,
  collect,
  plan,
  expand,
  exposesSnippet,
  routesSnippet,
  routesFor,
  apisFor,
  snippets
};
