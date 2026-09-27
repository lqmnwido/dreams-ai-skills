"use strict";

/**
 * The intake.
 *
 * Two flows, and the difference is the whole point of the detection step.
 *
 *   NEW repository  — nothing exists yet, so the questions establish identity:
 *                     what kind of module, what it is called, what sub-module it
 *                     covers, and what use case it exists for.
 *
 *   EXISTING module — the repository already has a name, a federation identity,
 *                     a port and a route prefix. Asking the user to retype those
 *                     is noise, and a mistyped answer silently breaks the
 *                     federation contract. So every identity question is
 *                     pre-filled from the detection evidence and presented as a
 *                     confirmation, while the questions that actually need a
 *                     human are the ones about the work: what kind of scope, which
 *                     sub-module, what is the use case or the defect.
 *
 * Every question exposes a `flag`, so the entire flow can be driven
 * non-interactively from the command line in CI or in a scripted bootstrap.
 */

const { MODULE_KINDS, SCOPE_KINDS, SCAFFOLD_KINDS, MODULE_ENV_PREFIX } = require("./paths");
const naming = require("./naming");

const YES_NO_VALID = /^(y|yes|n|no|t|f|true|false|1|0)$/i;

/**
 * Drop every placeholder answer before anything is derived from it. A literal
 * "(set me)" reaching a document is worse than an empty value, because it reads
 * as content — whereas an empty value leaves a greppable `{{TOKEN}}` behind.
 */
function dropUnanswered(answers) {
  const clean = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === "(set me)") continue;
    clean[key] = value;
  }
  return clean;
}

function byId(list, id) {
  return list.find((entry) => entry.id === id) || null;
}

// One implementation of each transformation, in `lib/naming.js`, so a slug used
// for a bucket, a repository name and a Java package cannot drift apart.
const slugify = naming.slugify;
const titleCase = naming.titleCase;
const pascal = naming.pascal;

/** Derive `reports` from "Reports Module", `REPORTS`, "the reports module". */
function guessModuleName(name) {
  const slug = slugify(name);
  return slug.replace(/-(module|mfe|app|application|service|api|frontend)$/g, "") || slug;
}

function unique(values) {
  return [...new Set(values.filter((v) => v !== undefined && v !== null && v !== ""))];
}

/** Shown in the identity confirmation prompt; the real values are detected. */
const IDENTITY_PLACEHOLDER = "module / display / port / route prefix, pre-filled from the repository";

/* ------------------------------------------------------------------ */
/* New repository questions                                           */
/* ------------------------------------------------------------------ */

const NEW_QUESTIONS = [
  {
    key: "SCOPE_KIND",
    flag: "scope",
    type: "choice",
    prompt: "What kind of work is starting in this repository?",
    choices: SCOPE_KINDS.map((s) => ({ id: s.id, label: s.label, hint: s.doc })),
    default: "new-feature",
    validate: (v) => (byId(SCOPE_KINDS, v) ? true : `unknown scope "${v}" (expected: ${SCOPE_KINDS.map((s) => s.id).join(", ")})`)
  },
  {
    key: "MODULE_KIND",
    flag: "kind",
    type: "choice",
    prompt: "What kind of repository is this?",
    choices: MODULE_KINDS.map((m) => ({ id: m.id, label: m.label, hint: m.hint })),
    default: "remote-module",
    validate: (v) => (byId(MODULE_KINDS, v) ? true : `unknown module kind "${v}" (expected: ${MODULE_KINDS.map((m) => m.id).join(", ")})`)
  },
  {
    key: "MODULE_NAME",
    flag: "module",
    type: "text",
    prompt: "Module name (the federation remote name, lowercase, no spaces)",
    hint: "e.g. v2t, reports — a module called \"Module Demo\" uses module-demo",
    default: (ctx) => guessModuleName(ctx.flags.name || ""),
    validate: (v) =>
      /^[a-z0-9][a-z0-9_-]*$/.test(String(v)) ? true : "use lowercase letters, digits, hyphen or underscore only"
  },
  {
    key: "MODULE_DISPLAY",
    flag: "display",
    type: "text",
    prompt: "Module display name (shown in the Shell menu and fallback)",
    hint: "e.g. V2T, Reports, Module Demo",
    default: (ctx) => titleCase(ctx.MODULE_NAME || "")
  },
  {
    // The slug is the one value three different consumers depend on: the MinIO
    // bucket, the two scaffolded repository names and the Java package. It is a
    // question rather than a silent derivation because each of those is awkward
    // to change after the fact, and because the derived default is right in the
    // common case and visible when it is not.
    key: "MODULE_SLUG",
    flag: "slug",
    type: "text",
    prompt: "Module slug — bucket name and the root of both repository names",
    hint: "e.g. module-demo → module_demo_fe, module_demo_be, bucket module-demo",
    default: (ctx) => slugify(ctx.MODULE_NAME || ""),
    validate: (v) =>
      /^[a-z0-9][a-z0-9-]*$/.test(String(v)) ? true : "use lowercase letters, digits and hyphens only"
  },
  {
    key: "SCAFFOLD",
    flag: "parts",
    type: "choice",
    prompt: "What should this install create?",
    choices: SCAFFOLD_KINDS.map((s) => ({ id: s.id, label: s.label, hint: s.hint })),
    default: (ctx) => (ctx.MODULE_KIND === "module-pair" ? "both" : "docs"),
    validate: (v) =>
      byId(SCAFFOLD_KINDS, v) ? true : `unknown scaffold "${v}" (expected: ${SCAFFOLD_KINDS.map((s) => s.id).join(", ")})`
  },
  {
    key: "SUBMODULES",
    flag: "submodule",
    type: "text",
    prompt: "Sub-module name(s) this repository covers (comma separated, blank if none)",
    hint: "e.g. program/senarai-program, laporan/bulanan",
    default: () => "",
    validate: (v) =>
      String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .every((s) => /^[a-z0-9][a-z0-9/_-]*$/i.test(s))
        ? true
        : "use path-like names, e.g. laporan/bulanan"
  },
  {
    key: "USE_CASE",
    flag: "usecase",
    type: "multiline",
    prompt: "Use case — what does this module exist for, and who uses it?",
    hint: "one line per point"
  },
  {
    key: "ROUTE_PREFIX",
    flag: "route-prefix",
    type: "text",
    prompt: "Shell route prefix for this module",
    hint: "e.g. /v2t",
    default: (ctx) => `/${ctx.MODULE_NAME || "module"}`,
    validate: (v) => (String(v).startsWith("/") ? true : "must start with /")
  },
  {
    key: "ROLE_KEY",
    flag: "role",
    type: "text",
    prompt: "Role id that grants access to this module",
    hint: "e.g. adminv2t, adminReports",
    default: (ctx) => `admin${pascal(ctx.MODULE_NAME || "module")}`,
    validate: (v) => (/^[A-Za-z][A-Za-z0-9_]*$/.test(String(v)) ? true : "use a JavaScript-safe identifier")
  },
  {
    key: "REMOTE_PORT",
    flag: "port",
    type: "text",
    prompt: "Local development port for this repository",
    hint: "shell 3000, v2t 3001, ui n/a",
    default: (ctx) => (ctx.MODULE_KIND === "shell" ? "3000" : ctx.MODULE_KIND === "shared-ui" ? "n/a" : "3004"),
    validate: (v) => (v === "n/a" || /^[0-9]{4,5}$/.test(String(v)) ? true : "use a port number or n/a")
  },
  {
    key: "BACKEND_PORT",
    flag: "backend-port",
    type: "text",
    prompt: "Local port for this module's own backend service",
    hint: "the service this module owns, not the Shell's",
    // Asked only when a backend half is being created. A frontend that has no
    // backend of its own has no port to state, and inventing one would put a
    // number in a document that nothing listens on.
    when: (ctx) => wantsBackend(scaffoldParts(ctx)),
    default: (ctx) => (ctx.MODULE_KIND === "backend-api" ? "8080" : "8081"),
    validate: (v) => (/^[0-9]{4,5}$/.test(String(v)) ? true : "use a port number")
  },
  {
    key: "API_BASES",
    flag: "apis",
    type: "text",
    prompt: "Backend API base env vars this module reads (comma separated)",
    hint: "e.g. VUE_APP_URL_KOD, VUE_APP_URL_ASR",
    default: (ctx) => (ctx.MODULE_KIND === "backend-api" ? "PORT" : "VUE_APP_URL_KOD")
  },
  {
    key: "SHELL_REPO",
    flag: "shell",
    type: "text",
    prompt: "Path or URL of the Shell repository that hosts this module",
    hint: "blank for the Shell itself",
    default: (ctx) => (ctx.MODULE_KIND === "shell" ? "" : "../shell")
  },
  {
    key: "UI_DEPENDENCY",
    flag: "ui-dep",
    type: "text",
    prompt: "How does this repository depend on the shared UI package?",
    hint: "git branch, file link, or n/a",
    default: (ctx) =>
      ctx.MODULE_KIND === "shared-ui" ? "n/a" : "git+https://kai.2enapps.my/d-reams/frontend/dreams-mfe.git#lqmnwido/ui"
  }
];

/* ------------------------------------------------------------------ */
/* Existing module questions                                          */
/* ------------------------------------------------------------------ */

const EXISTING_QUESTIONS = [
  {
    key: "SCOPE_KIND",
    flag: "scope",
    type: "choice",
    prompt: "What kind of work is this?",
    choices: SCOPE_KINDS.map((s) => ({ id: s.id, label: s.label, hint: s.doc })),
    default: () => "change-request",
    validate: (v) => (byId(SCOPE_KINDS, v) ? true : `unknown scope "${v}" (expected: ${SCOPE_KINDS.map((s) => s.id).join(", ")})`)
  },
  {
    key: "CONFIRM_IDENTITY",
    flag: "confirm-identity",
    type: "confirm",
    prompt: `Use the detected module identity? (${IDENTITY_PLACEHOLDER})`,
    default: (ctx) => true,
    validate: (v) => (YES_NO_VALID.test(String(v)) ? true : `expected yes or no, got "${v}"`)
  },
  {
    key: "MODULE_DISPLAY",
    flag: "display",
    type: "text",
    prompt: "Display name for this repository",
    hint: "what menus, titles and documents call it",
    // Asked only when the repository has no `src/metadata.js` to read it from.
    // A display name is a human judgement, so it is never derived silently.
    when: (ctx) => !(ctx.detected.metadata && ctx.detected.metadata.displayName),
    default: (ctx) => titleCase(String(ctx.detected.package.name || "").split("/").pop())
  },
  {
    key: "SUBMODULES",
    flag: "submodule",
    type: "text",
    prompt: "Which sub-module(s) does this work touch? (comma separated)",
    hint: "e.g. program/senarai-program",
    // From the expose keys, minus `./`, minus the `views/` prefix the documents
    // already add themselves, and minus `./metadata` — which is a metadata
    // export, not a page. So `./views/program/senarai-program` becomes
    // `program/senarai-program`, which is what `src/views/{{SUBMODULE}}.vue`
    // in the templates expects.
    default: (ctx) =>
      unique(
        (ctx.detected.federation.exposes || [])
          .map((e) => e.key.replace(/^\.\//, ""))
          .filter((key) => key !== "metadata")
          .map((key) => key.replace(/^views\//, ""))
      ).join(", ")
  },
  {
    key: "USE_CASE",
    flag: "usecase",
    type: "multiline",
    prompt: ctx => {
      const s = ctx.detected;
      if (s.kind === "shell") return "What is this work for, in one line per point?";
      if (s.kind === "shared-ui") return "What capability does the shared package need to gain?";
      if (s.kind === "backend-api") return "What behaviour or endpoint does the API need to change?";
      return s.SCOPE_KIND === "debug"
        ? "Describe the defect: what is wrong, where, and since when?"
        : "Describe the change: what is different afterwards, and who notices?";
    },
    hint: "one line per point"
  },
  {
    key: "BLAST_RADIUS",
    flag: "blast-radius",
    type: "text",
    prompt: "Which other repositories does this touch? (comma separated, blank if none)",
    hint: "e.g. shell, ui, api-kod",
    default: (ctx) => guessBlastRadius(ctx)
  }
];

/* ------------------------------------------------------------------ */
/* Shared tail                                                        */
/* ------------------------------------------------------------------ */

const TAIL_QUESTIONS = [
  {
    key: "REPO_NAME",
    flag: "name",
    type: "text",
    prompt: "Repository name",
    default: (ctx) => ctx.detected.package.name || require("path").basename(ctx.detected.cwd)
  },
  {
    key: "OWNER",
    flag: "owner",
    type: "text",
    prompt: "Owning team or engineer",
    default: () => "lqmnwido"
  },
  {
    key: "DEPLOY_TARGET",
    flag: "deploy",
    type: "choice",
    prompt: "Where does this repository deploy?",
    choices: [
      { id: "static", label: "Static host (CDN / web server)", hint: "shell, remote modules, ui package output" },
      { id: "container", label: "Container platform", hint: "backend APIs" },
      { id: "library", label: "Consumed as a package only", hint: "@2enapps/ui" },
      { id: "unknown", label: "Not decided yet" }
    ],
    default: (ctx) =>
      ctx.MODULE_KIND === "backend-api" ? "container" : ctx.MODULE_KIND === "shared-ui" ? "library" : "static"
  }
];

function guessBlastRadius(ctx) {
  const d = ctx.detected;
  const hits = [];
  if (d.kind === "remote-module" || d.kind === "shared-ui") {
    if (d.ui.isGit) hits.push("ui");
    hits.push("shell");
  }
  if (d.kind === "shell" && d.federation.remotes.length) hits.push(...d.federation.remotes);
  return unique(hits).join(", ");
}

/**
 * Which halves of a module this install creates.
 *
 * Resolved in three steps so that the answer is never guessed: the `--parts`
 * flag, then the answered `SCAFFOLD` question, then the module kind. `module-pair`
 * implies both halves; everything else implies governance documents only, because
 * scaffolding a repository a user did not ask for is not a reversible act.
 */
function scaffoldParts(ctx) {
  const explicit = (ctx.flags && ctx.flags.parts) || ctx.SCAFFOLD;
  if (explicit && byId(SCAFFOLD_KINDS, explicit)) return explicit;
  return ctx.MODULE_KIND === "module-pair" ? "both" : "docs";
}

function wantsBackend(parts) {
  return parts === "both" || parts === "backend";
}

function wantsFrontend(parts) {
  return parts === "both" || parts === "frontend";
}

/* ------------------------------------------------------------------ */
/* Assembly                                                           */
/* ------------------------------------------------------------------ */

/** Pick the flow and return the ordered question list plus derived context. */
function buildFlow(detected) {
  const flow = detected.isNew ? "new" : "existing";
  const head = flow === "new" ? NEW_QUESTIONS : EXISTING_QUESTIONS;
  return { flow, questions: [...head, ...TAIL_QUESTIONS] };
}

/** Apply a raw answer map to the detected report and produce the render context. */
function buildContext(detected, rawAnswers) {
  const answers = dropUnanswered(rawAnswers);
  const identity = deriveIdentity(detected, answers);

  // The existing-module flow never asks which API bases the module reads — it can
  // be read from the repository instead, from the env files that already list
  // them. A wrong list here is a `undefined/kategori-program` 404 at runtime.
  const detectedApiKeys = (detected.env.keys || []).filter(
    (key) => /^VUE_APP_(URL|BASE|API)/.test(key) || key === "PORT"
  );

  const apiList = unique(
    String(answers.API_BASES || detectedApiKeys.join(", "))
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const submodules = unique(
    String(answers.SUBMODULES || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  const useCase = Array.isArray(answers.USE_CASE) ? answers.USE_CASE.join("\n") : String(answers.USE_CASE || "");

  // The repository's role: the answered question in Flow A, the detection in
  // Flow B. Never guessed, because everything derived from it — which tables the
  // README gets, which port the service listens on — hangs off this one value.
  const kind = answers.MODULE_KIND || detected.kind || "";

  const context = {
    ...answers,
    ...identity,
    REPO_NAME: answers.REPO_NAME || detected.package.name || "",
    PRODUCT_NAME: "D-ReAMS",
    ORGANISATION: "2enapps",
    SUBMODULES: submodules,
    SUBMODULE: submodules[0] || "",
    SUBMODULE_2: submodules[1] || "",
    // The route `name`, not a path: `program-senarai-program`. Derived, because a
    // hand-written route name that disagrees with its path only shows up later
    // in a breadcrumb.
    SUBMODULE_SLUG: submodules[0] ? slugify(submodules[0]) : "",
    SUBMODULES_LIST: submodules.map((name) => `- \`${name}\``).join("\n"),
    API_BASES: apiList,
    API_BASES_LIST: apiList.map((name) => `- \`${name}\``).join("\n"),
    USE_CASE: useCase,
    USE_CASE_LIST: useCase
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n"),
    BLAST_RADIUS: answers.BLAST_RADIUS || "",
    DEPLOY_TARGET: answers.DEPLOY_TARGET || "unknown",
    OWNER: answers.OWNER || "",

    /* The module's own identity in the wider platform — derived, never asked */
    // Everything below comes from `MODULE_SLUG`, so the bucket, the repository
    // names, the Java package and the env prefix cannot be typed four times and
    // end up disagreeing.
    MODULE_SLUG: slugify(answers.MODULE_SLUG || answers.MODULE_NAME || identity.MODULE_NAME || ""),
    SCAFFOLD: scaffoldParts(rawAnswers),
    BACKEND_PORT: answers.BACKEND_PORT || (kind === "backend-api" ? "8080" : "8081")
  };

  const names = naming.deriveNames(context.MODULE_SLUG);

  context.MODULE_SNAKE = names.snake;
  context.FRONTEND_REPO = names.frontendRepo;
  context.BACKEND_REPO = names.backendRepo;
  context.BUCKET = names.bucket;
  context.BASE_PACKAGE = names.basePackage;
  context.MODULE_CLASS = names.pascal;
  context.API_BASE_ENV = `${MODULE_ENV_PREFIX}${identity.MODULE_PASCAL_UPPER || context.MODULE_SLUG.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  context.MODULE_BASE_URL = `http://localhost:${context.BACKEND_PORT}/api`;
  context.MINIO_ENDPOINT = "http://localhost:9000";
  context.MINIO_CONSOLE = "http://localhost:9001";

  return context;
}

/**
 * Identity is the part that must never be wrong, because a wrong remote name or
 * expose key is not a lint error — it is a runtime failure in the Shell with a
 * generic "Module does not exist in container" message.
 */
function deriveIdentity(detected, answers) {
  const confirmed = answers.CONFIRM_IDENTITY !== false;

  const fromDetection = {
    // `remoteName` first, because it is the string that actually appears in the
    // Shell's `import("v2t/…")`. A library and a backend have no remote name, so
    // for those the package's own unscoped name is the closest true answer.
    MODULE_NAME:
      detected.metadata?.remoteName ||
      detected.federation.name ||
      (["shared-ui", "backend-api"].includes(detected.kind)
        ? slugify(String(detected.package.name || "").split("/").pop())
        : ""),
    MODULE_DISPLAY: detected.metadata?.displayName || "",
    ROUTE_PREFIX: detected.metadata?.routePrefix || "",
    ROLE_KEY: "",
    REMOTE_PORT: ""
  };

  const explicit = {
    MODULE_NAME: answers.MODULE_NAME || "",
    MODULE_DISPLAY: answers.MODULE_DISPLAY || "",
    ROUTE_PREFIX: answers.ROUTE_PREFIX || "",
    ROLE_KEY: answers.ROLE_KEY || "",
    REMOTE_PORT: answers.REMOTE_PORT || ""
  };

  const pick = (key, fallback) => {
    if (explicit[key] && explicit[key] !== "n/a") return explicit[key];
    if (!confirmed && explicit[key]) return explicit[key];
    return fromDetection[key] || fallback;
  };

  // A fabricated identity is worse than an unresolved token: a wrong remote name
  // is a runtime federation failure in the Shell, and a wrong role id is a
  // silent authorization difference. So nothing here is invented.
  const moduleName = pick("MODULE_NAME", "");
  const display = pick("MODULE_DISPLAY", "") || (moduleName ? titleCase(moduleName) : "");
  const routePrefix = pick("ROUTE_PREFIX", "") || (moduleName ? `/${moduleName}` : "");
  const roleKey = pick("ROLE_KEY", "") || (moduleName ? `admin${pascal(moduleName)}` : "");
  const port = pick("REMOTE_PORT", "n/a") || "n/a";

  return {
    MODULE_NAME: moduleName,
    MODULE_DISPLAY: display,
    // The repository's role in the platform. Detected, not asked, in the
    // existing flow — asking a user to confirm what the code already says adds
    // nothing, and `{{MODULE_KIND}}` must never be left open in the router.
    MODULE_KIND: answers.MODULE_KIND || detected.kind || "",
    FEDERATION_NAME: detected.federation.name || "",
    SHARED_SINGLETONS: (detected.federation.shared || []).join(", "),
    MODULE_PASCAL: moduleName ? pascal(moduleName) : "",
    // `VUE_APP_V2T_PORT` is how the environment is namespaced per module, so this
    // is derived rather than asked — a hand-typed one is a silent env mismatch.
    MODULE_PASCAL_UPPER: moduleName ? moduleName.toUpperCase().replace(/[^A-Z0-9]+/g, "_") : "",
    MODULE_CAMEL: moduleName ? moduleName.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()) : "",
    ROUTE_PREFIX: routePrefix,
    ROUTE_PATH: routePrefix ? routePrefix.replace(/^\//, "") : "",
    ROLE_KEY: roleKey,
    REMOTE_PORT: port === "n/a" ? "n/a" : String(port),
    EXPOSES: (detected.federation.exposes || []).map((e) => e.key),
    EXPOSE_LIST: (detected.federation.exposes || [])
      .map((e) => `\`${e.key}\` → \`${e.target}\``)
      .join("\n"),
    API_VERSION: detected.metadata?.apiVersion || 1,
    MODULE_VERSION: detected.package.version || "0.1.0",
    UI_DEPENDENCY:
      detected.ui.dependency ||
      (answers.UI_DEPENDENCY && answers.UI_DEPENDENCY !== "n/a" ? answers.UI_DEPENDENCY : "") ||
      "n/a",
    SHELL_REPO: answers.SHELL_REPO || (detected.kind === "shell" ? "this repository" : "../shell"),
    SHELL_ORIGIN: `http://localhost:${detected.kind === "shell" ? "3000" : "3000"}`,
    HOSTED_REMOTES: (detected.federation.remotes || []).join(", ") || "—"
  };
}

module.exports = {
  buildFlow,
  buildContext,
  deriveIdentity,
  scaffoldParts,
  wantsBackend,
  wantsFrontend,
  slugify,
  titleCase,
  pascal,
  guessModuleName,
  NEW_QUESTIONS,
  EXISTING_QUESTIONS,
  TAIL_QUESTIONS
};
