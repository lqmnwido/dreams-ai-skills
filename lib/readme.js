"use strict";

/**
 * The module README block.
 *
 * Every module's README carries a generated table between markers: routes for a
 * frontend repository, endpoints for a backend one. Three rules keep that table
 * trustworthy:
 *
 *   1. **Nothing outside the markers is ever touched.** A README is written by
 *      hand and often holds the only explanation of why the module exists. The
 *      block is inserted or refreshed; the rest of the file is left byte for
 *      byte alone.
 *
 *   2. **Rows are read from the code, not from memory.** The router and the
 *      `@*Mapping` annotations are the contract; a table that disagrees with
 *      them is worse than no table. When nothing can be read, the rows fall back
 *      to the sub-modules recorded in the governance tree and say so.
 *
 *   3. **A README that does not exist yet is created; one that does is never
 *      rewritten.** There is no flag that discards hand-written content.
 */

const fs = require("fs");
const path = require("path");

const { README_BLOCKS, MARKER } = require("./paths");
const { walkFiles, read } = require("./scan");
const { slugify } = require("./naming");
const { detectExposes, detectFederationName, readIfExists } = require("./detect");

const README_NAME = "README.md";

/* ------------------------------------------------------------------ */
/* Reading the code                                                    */
/* ------------------------------------------------------------------ */

/**
 * Routes declared by this repository's router.
 *
 * Only `path:` occurrences are taken as routes, and only the nearest following
 * `name:`/`import(...)` within a few hundred characters is attributed to them —
 * a router file also contains `redirect`, `meta.path` and string literals that a
 * looser pattern would happily promote into the README.
 *
 * When there is no router — the common case for a D-ReAMS remote, whose pages
 * the Shell registers from the expose keys — the routes are derived from
 * `vue.config.js` instead. Those rows are the same contract seen from the other
 * side, so they are the truthful answer, not a substitute for one.
 */
function detectRoutes(root) {
  const { files } = walkFiles(root, (name) => /\.(js|mjs|cjs|ts)$/.test(name), { max: 300 });
  const routerFiles = files.filter((file) => /(^|\/)(router|routes)(\/index)?\.(js|mjs|cjs|ts)$/.test(file));
  const rows = [];

  for (const file of routerFiles) {
    const source = read(file);
    if (!source) continue;
    const router = path.relative(root, file).split(path.sep).join("/");

    const re = /path\s*:\s*["'`]([^"'`]+)["'`]/g;
    let match;
    while ((match = re.exec(source)) !== null) {
      const route = match[1];
      if (!route || /^(https?:)?\/\//.test(route)) continue;

      const tail = source.slice(match.index, match.index + 500);
      const name = /name\s*:\s*["'`]([^"'`]*)["'`]/.exec(tail);
      const view = /import\s*\(\s*["'`]([^"'`]+)["'`]/.exec(tail);
      const nameValue = name ? name[1] : "";
      const viewValue = view ? view[1] : "";

      // A `redirect` entry is navigation plumbing, not a page. Listing it would
      // put a row in the README whose "View" column nobody can open.
      if (!nameValue && !viewValue) continue;

      rows.push({ route, name: nameValue, view: resolveView(router, viewValue) });
    }
  }

  const fromRouter = dedupe(rows, (row) => row.route);
  return fromRouter.length ? fromRouter : routesFromExposes(root);
}

/**
 * An import inside `src/preview/router.js` says `../views/x.vue` — correct from
 * where it is written, and meaningless in a README, which speaks about files
 * from the repository root. Paths already written root-relative are left alone.
 */
function resolveView(routerRelative, view) {
  if (!view || !/^\.\.?\//.test(view)) return view;
  return path.posix.normalize(path.posix.join(path.posix.dirname(routerRelative), view));
}

/**
 * The pages this remote publishes, read from `vue.config.js` and attributed to
 * the route prefix in `src/metadata.js` — the two files the Shell actually
 * consumes. `./metadata` is an integration manifest, not a page, and is skipped.
 */
function routesFromExposes(root) {
  const vueConfig = readIfExists(path.join(root, "vue.config.js"));
  if (!vueConfig) return [];

  const prefix = readRoutePrefix(root);
  const name = detectFederationName(vueConfig);
  const exposes = detectExposes(vueConfig)
    .map((entry) => entry.key.replace(/^\.\//, ""))
    .filter((key) => key.startsWith("views/"))
    .map((key) => key.slice("views/".length));

  return exposes.map((page) => ({
    route: joinRoute(prefix, page),
    name: [name, slugify(page)].filter(Boolean).join("-"),
    view: `src/views/${page}.vue`
  }));
}

function readRoutePrefix(root) {
  for (const relative of ["src/metadata.js", "src/mfe/metadata.js"]) {
    const raw = readIfExists(path.join(root, relative));
    if (!raw) continue;
    // `routePrefix: "/x"` in the exported object, or `const routePrefix = "/x"`
    // above it. Only a quoted literal counts: `routePrefix: process.env.PREFIX`
    // names nothing, and an empty prefix produces routes the Shell will not
    // register.
    const match = /routePrefix\s*[:=]\s*["'`]([^"'`]*)["'`]/.exec(raw);
    if (match) return match[1];
  }
  return "";
}

function joinRoute(prefix, sub) {
  return `${prefix}/${sub}`.replace(/\/{2,}/g, "/");
}

/** Endpoints declared by this service's Spring controllers. */
function detectApis(root) {
  const { files } = walkFiles(root, (name) => name.endsWith(".java"), { max: 400 });
  const rows = [];

  for (const file of files) {
    const source = read(file);
    if (!source || !/@RestController|@Controller/.test(source)) continue;
    const relative = path.relative(root, file).split(path.sep).join("/");

    const classArgs = /@RequestMapping\s*\(\s*([^)]*)\)/.exec(source);
    const base = normalizePath(mappingValue(source, classArgs ? classArgs[1] : "")).replace(/\/$/, "");

    const re = /@(Get|Post|Put|Delete|Patch|Head|Options)Mapping\s*\(([^)]*)\)\s*(?:public\s+)?[\w<>,.\[\]\s?]+\s+(\w+)\s*\(/g;
    let match;
    while ((match = re.exec(source)) !== null) {
      const verb = match[1].toUpperCase();
      const handler = match[3];
      const sub = normalizePath(mappingValue(source, match[2]));
      const endpoint = joinPaths(base, sub);
      if (!endpoint || endpoint === "/") continue;
      rows.push({ method: verb, endpoint, handler: `${path.basename(file, ".java")}.${handler}`, source: relative });
    }
  }

  return dedupe(rows, (row) => `${row.method} ${row.endpoint}`);
}

/**
 * The path an annotation names — as a literal, or as a reference to a
 * `static final String` constant.
 *
 * A controller that declares its base path once and points the annotation at
 * it is the correct shape: the route and everything generated from it cannot
 * drift. A reader that only understood literals would report such a controller
 * as having no base path at all, which is worse than reporting it slightly
 * late — so the constant is resolved here, in the same file where it lives.
 */
function mappingValue(source, annotationArgs) {
  if (!annotationArgs) return "";
  const literal = /["']([^"']*)["']/.exec(annotationArgs);
  if (literal) return literal[1];

  const name = annotationArgs.trim().split(".").pop().replace(/\s+/g, "");
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return "";
  const declared = new RegExp(`(?:static\\s+final\\s+)?String\\s+${name}\\s*=\\s*"([^"]*)"`).exec(source);
  return declared ? declared[1] : "";
}

/**
 * `{key:.+}` is how Spring says "match slashes too". The README speaks in
 * ordinary path parameters, so the regex suffix is dropped on the way out.
 */
function normalizePath(value) {
  return String(value || "").replace(/\{(\w+):[^}]+\}/g, "{$1}");
}

function joinPaths(base, sub) {
  const joined = `${base || ""}/${sub || ""}`.replace(/\/{2,}/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function dedupe(rows, key) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const id = key(row);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(row);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Fallbacks                                                           */
/* ------------------------------------------------------------------ */

/**
 * Routes implied by the governance tree when the router cannot be read — a new
 * repository has no router yet, and an empty table would be read as "no routes".
 * Every row says it is derived, so nobody mistakes it for observed behaviour.
 */
function derivedRoutes(context) {
  const submodules = Array.isArray(context.SUBMODULES) ? context.SUBMODULES : [];
  const prefix = context.ROUTE_PREFIX || "";

  if (!submodules.length) {
    return [
      {
        route: prefix || "/",
        name: [context.MODULE_NAME, context.ROUTE_PATH].filter(Boolean).join("-"),
        view: "",
        derived: true
      }
    ];
  }

  return submodules.map((submodule) => ({
    route: joinPaths(prefix || "", submodule),
    name: [context.MODULE_NAME, slugify(submodule)].filter(Boolean).join("-"),
    view: `src/views/${submodule}.vue`,
    derived: true
  }));
}

/**
 * Endpoints implied by the governance tree when no controller can be read — a
 * freshly scaffolded service, or a repository whose Java sources are outside
 * this working directory. The rows mirror the scaffold exactly, so an empty
 * scan produces a plausible table rather than a missing one, and they carry
 * `derived: true` so the rendered table says where they came from.
 */
function derivedApis(context) {
  const base = joinPaths("/api", context.MODULE_SLUG || context.MODULE_NAME || "module");
  return [
    { method: "POST", endpoint: `${base}/documents`, handler: "DocumentController.upload", derived: true },
    { method: "GET", endpoint: `${base}/documents/{key}`, handler: "DocumentController.resolve", derived: true },
    { method: "DELETE", endpoint: `${base}/documents/{key}`, handler: "DocumentController.remove", derived: true }
  ];
}

/**
 * What a module workspace is made of.
 *
 * A module is two repositories, and the directory above them says nothing about
 * it: no package manifest, no router, no controller. Everything worth knowing —
 * which half listens where, which one owns the bucket — exists only in the
 * intake, so the root README carries it as one generated table at the Full
 * review level. A half that is not being created is omitted rather than filled
 * with a dash, because a repository that does not exist is not part of the
 * inventory.
 */
function derivedWorkspace(context) {
  const rows = [];
  const parts = context.SCAFFOLD || "docs";

  if ((parts === "both" || parts === "frontend") && context.FRONTEND_REPO) {
    rows.push({
      repository: context.FRONTEND_REPO,
      role: "federated frontend module",
      port: context.REMOTE_PORT && context.REMOTE_PORT !== "n/a" ? context.REMOTE_PORT : "—",
      api: context.API_BASE_ENV || "—"
    });
  }
  if ((parts === "both" || parts === "backend") && context.BACKEND_REPO) {
    rows.push({
      repository: context.BACKEND_REPO,
      role: "Spring Boot service",
      port: context.BACKEND_PORT || "—",
      api: context.MODULE_BASE_URL || "—",
      bucket: context.BUCKET || "—"
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

const PROVENANCE = {
  routes: `Generated by \`${MARKER}\` from this repository's router — edit the router, then re-run the installer.`,
  api: `Generated by \`${MARKER}\` from this repository's controllers — edit the controller, then re-run the installer.`,
  workspace: `Generated by \`${MARKER}\` from the answers given at install time — re-run the installer to change them.`
};

/**
 * Rows read from code and rows inferred from the governance tree look identical
 * in a table, and a reader has no way to tell them apart. When any row was
 * inferred, the table says so — otherwise a scaffolded README would be read as
 * a description of code that does not exist yet.
 */
function derivationNotice(rows, subject) {
  if (!rows.some((row) => row.derived)) return [];
  return [
    "",
    `> ${rows.length} row(s) below are derived from the governance tree, not read from ` +
      `source — this repository declares no ${subject} yet. They describe what a ` +
      `fresh install sets out, and are replaced by observed values on the next run.`
  ];
}

function table(rows, columns) {
  const head = `| ${columns.map((c) => c.title).join(" | ")} |`;
  const rule = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${columns.map((c) => c.cell(row)).join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}

function renderRoutes(rows) {
  return [
    PROVENANCE.routes,
    ...derivationNotice(rows, "router"),
    "",
    table(rows, [
      { title: "Route", cell: (r) => `\`${r.route}\`` },
      { title: "Name", cell: (r) => (r.name ? `\`${r.name}\`` : "—") },
      { title: "View", cell: (r) => (r.view ? `\`${r.view}\`` : "—") }
    ])
  ].join("\n");
}

function renderApis(rows) {
  return [
    PROVENANCE.api,
    ...derivationNotice(rows, "controller"),
    "",
    table(rows, [
      { title: "Method", cell: (r) => `\`${r.method}\`` },
      { title: "Endpoint", cell: (r) => `\`${r.endpoint}\`` },
      { title: "Handler", cell: (r) => (r.handler ? `\`${r.handler}\`` : "—") }
    ])
  ].join("\n");
}

function renderWorkspace(rows) {
  return [
    PROVENANCE.workspace,
    "",
    table(rows, [
      { title: "Repository", cell: (r) => `\`${r.repository}\`` },
      { title: "Role", cell: (r) => r.role },
      { title: "Port", cell: (r) => (r.port && r.port !== "—" ? `\`${r.port}\`` : "—") },
      { title: "API base", cell: (r) => (r.api ? `\`${r.api}\`` : "—") },
      { title: "Bucket", cell: (r) => (r.bucket ? `\`${r.bucket}\`` : "—") }
    ])
  ].join("\n");
}

const RENDERERS = { routes: renderRoutes, api: renderApis, workspace: renderWorkspace };

function render(mode, rows) {
  const block = README_BLOCKS[mode];
  const renderer = RENDERERS[mode];
  if (!block || !renderer) throw new Error(`unknown README block "${mode}"`);
  return [block.start, `<!-- managed-by: ${MARKER} -->`, "", renderer(rows), block.end].join("\n");
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

function blockRange(content, mode) {
  const block = README_BLOCKS[mode];
  const start = content.indexOf(block.start);
  if (start === -1) return null;
  const end = content.indexOf(block.end, start);
  if (end === -1) return null;
  return { start, end: end + block.end.length };
}

/**
 * Insert or refresh the block in `cwd/README.md`.
 *
 * The three outcomes are deliberately distinguishable: `created` means the file
 * did not exist, `refreshed` means an existing block was replaced in place, and
 * `appended` means a README with no block gained one at the end. Uninstall uses
 * that record to decide whether deleting the whole file is safe.
 */
function updateReadme(cwd, mode, markdown) {
  const file = path.join(cwd, README_NAME);
  const existed = fs.existsSync(file);
  const content = existed ? fs.readFileSync(file, "utf8") : "";
  const range = blockRange(content, mode);

  if (range) {
    const next = `${content.slice(0, range.start)}${markdown}${content.slice(range.end)}`;
    if (next === content) return { action: "unchanged", file };
    fs.writeFileSync(file, next, "utf8");
    return { action: "refreshed", file, created: false };
  }

  const block = README_BLOCKS[mode];
  const heading = `## ${block.title}`;
  const section = existed ? `\n\n${heading}\n\n${markdown}\n` : `# ${path.basename(cwd)}\n\n${heading}\n\n${markdown}\n`;
  const next = existed ? `${content.replace(/\s*$/, "")}${section}` : section;

  fs.writeFileSync(file, next, "utf8");
  return { action: existed ? "appended" : "created", file, created: !existed };
}

/** Remove the block, and the whole file if we were the ones who created it. */
function removeBlock(cwd, mode, { created = false } = {}) {
  const file = path.join(cwd, README_NAME);
  if (!fs.existsSync(file)) return { action: "absent", file };

  const content = fs.readFileSync(file, "utf8");
  const range = blockRange(content, mode);
  if (!range) return { action: "absent", file };

  const without = `${content.slice(0, range.start)}${content.slice(range.end)}`;
  const emptied = without.replace(/^#[^\n]*\n+/, "").trim() === "";

  if (created && emptied) {
    fs.rmSync(file);
    return { action: "removed-file", file };
  }

  fs.writeFileSync(file, without.replace(/\n{3,}/g, "\n\n"), "utf8");
  return { action: "removed-block", file };
}

/** Does this README still carry the generated block? Used by `check`. */
function hasBlock(cwd, mode) {
  const file = path.join(cwd, README_NAME);
  if (!fs.existsSync(file)) return false;
  return blockRange(fs.readFileSync(file, "utf8"), mode) !== null;
}

module.exports = {
  README_NAME,
  detectRoutes,
  detectApis,
  derivedRoutes,
  derivedApis,
  derivedWorkspace,
  renderRoutes,
  renderApis,
  renderWorkspace,
  render,
  updateReadme,
  removeBlock,
  hasBlock,
  blockRange
};
