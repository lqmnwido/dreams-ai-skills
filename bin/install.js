#!/usr/bin/env node

"use strict";

/**
 * dreams-ai-skills — install governance skills into one repository.
 *
 *   npx -y @lqmnwido/dreams-ai-skills
 *
 * The installer never writes outside the current working directory, never
 * modifies source, and never installs an npm package. It writes:
 *
 *   AGENTS.md                    the router every AI agent reads first
 *   .docs/project-governance/**  the governance tree
 *   README.md                    a routes / API table, between markers only
 *
 * and, when `--parts` asks for it, the two repositories a new module is made
 * of (`<slug>_fe` and `<slug>_be`). The one thing it may start is a local
 * MinIO container — and only after an explicit `--minio=install` or a yes at
 * the prompt; a non-interactive run prints the commands instead of acting.
 *
 * A previous install is detected and preserved unless `--force` is given; in
 * that case the originals are backed up next to the new files rather than
 * deleted, because a governance tree is edited by hand and that work is not
 * recoverable from git if it was never committed.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const skills = require("../index.js");
const { createPrompter } = require("../lib/prompt");
const readmeLib = require("../lib/readme");
const scaffoldLib = require("../lib/scaffold");
const minioLib = require("../lib/minio");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const BOOLEAN_FLAGS = new Set(["force", "yes", "dry-run", "check", "uninstall", "quiet", "help", "self", "no-readme"]);
const VALUE_FLAGS = new Set([
  "scope",
  "kind",
  "module",
  "display",
  "slug",
  "parts",
  "submodule",
  "usecase",
  "role",
  "port",
  "backend-port",
  "route-prefix",
  "apis",
  "shell",
  "ui-dep",
  "name",
  "owner",
  "deploy",
  "blast-radius",
  "confirm-identity",
  "minio",
  "bucket"
]);

const HELP = `
  @lqmnwido/dreams-ai-skills v${skills.VERSION}
  Per-repository governance skills for the D-ReAMS micro-frontend platform.

  Usage
    npx -y @lqmnwido/dreams-ai-skills [options]

  What it writes
    AGENTS.md                    the router every AI agent reads first
    .docs/project-governance/**  the governance tree (33 documents)
    README.md                    a routes / API table between markers
    <slug>_fe/, <slug>_be/       only when --parts asks for them

  Intake (every question has a matching flag, so the whole flow is scriptable)
    --scope=<id>              new-feature | change-request | debug
    --kind=<id>               shell | remote-module | shared-ui | backend-api | module-pair
    --module=<name>           federation remote name, e.g. v2t, module-demo
    --display=<label>         display name, e.g. V2T, Module Demo
    --slug=<slug>             module slug: bucket, repository names, Java package
    --parts=<id>              both | frontend | backend | docs
    --submodule=<a,b>         sub-module names, e.g. program/senarai-program
    --usecase=<text>          one-line use case (repeatable)
    --route-prefix=/v2t       Shell route prefix
    --role=<roleId>           role id granting access, e.g. adminv2t
    --port=<port|n/a>         local development port
    --backend-port=<port>     port of this module's own service
    --apis=<A,B>              backend API base env vars
    --shell=<path>            path or URL of the Shell repository
    --ui-dep=<value>          @2enapps/ui dependency, or n/a
    --name=<repoName>         repository name
    --owner=<name>            owning team or engineer
    --deploy=<id>             static | container | library | unknown

  Object storage
    --minio=<mode>            auto | install | check | skip
                               auto     detect, ask before doing anything
                               install  start MinIO in Docker and create the bucket
                               check    report status only
                               skip     do not look
    --bucket=<name>           override the bucket (default: the module slug)
    --no-readme               leave README.md untouched

  Behaviour
    --yes        non-interactive; use flag values and derived defaults
    --force      overwrite a previous install (originals are backed up)
    --dry-run    print the plan and the resolved context, write nothing
    --check      verify an existing installation and exit
    --uninstall  remove what this package wrote and exit
    --quiet      only print the summary
    --help       this text
`;

/**
 * Assign a flag value, accumulating repeats.
 *
 * `--usecase=a --usecase=b` has to mean two points, not "b overwrites a" — the
 * use case is the one answer that is naturally a list, and silently keeping only
 * the last point would produce a PRD with half the reason it exists.
 */
function setFlag(flags, key, value) {
  if (flags[key] === undefined) {
    flags[key] = value;
    return;
  }
  if (Array.isArray(flags[key])) {
    flags[key].push(value);
    return;
  }
  flags[key] = [flags[key], value];
}

function parseArgs(argv) {
  const flags = {};
  const bare = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      bare.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq !== -1) {
      const key = body.slice(0, eq).trim();
      const value = body.slice(eq + 1);
      if (BOOLEAN_FLAGS.has(key) && (value === "true" || value === "false" || value === "1" || value === "0")) {
        flags[key] = value === "true" || value === "1";
      } else {
        setFlag(flags, key, value);
      }
      continue;
    }
    if (BOOLEAN_FLAGS.has(body)) {
      flags[body] = true;
      continue;
    }
    if (VALUE_FLAGS.has(body)) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        setFlag(flags, body, next);
        i++;
      } else {
        setFlag(flags, body, "");
      }
      continue;
    }
    flags[body] = true;
  }

  // npm turns `--scope=new-feature` into npm_config_scope
  for (const key of VALUE_FLAGS) {
    const envKey = `npm_config_${key.replace(/-/g, "_")}`;
    if (flags[key] === undefined && process.env[envKey]) flags[key] = process.env[envKey];
  }
  if (process.env.npm_config_yes === "true" && flags.yes === undefined) flags.yes = true;
  if (process.env.npm_config_force === "true" && flags.force === undefined) flags.force = true;

  return { flags, bare };
}

function log(icon, message, quiet) {
  if (quiet) return;
  console.log(`  ${icon} ${message}`);
}

function heading(text) {
  console.log(`\n  ${text}\n  ${"-".repeat(Math.max(0, 66 - text.length))}`);
}

function backupFile(file) {
  if (!fs.existsSync(file)) return null;
  let backup = `${file}.bak`;
  let n = 1;
  while (fs.existsSync(backup)) backup = `${file}.bak.${n++}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function writeFileSafe(file, content, { force, dryRun, quiet }) {
  const relative = path.relative(process.cwd(), file) || file;

  if (fs.existsSync(file) && !force) {
    log("–", `kept existing ${relative} (use --force to replace)`, quiet);
    return "kept";
  }

  if (fs.existsSync(file) && force) {
    const backup = dryRun ? `${file}.bak` : backupFile(file);
    log("→", `backed up ${relative} → ${path.basename(backup)}`, quiet);
  }

  if (dryRun) {
    log("○", `would write ${relative}`, quiet);
    return "dry";
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
  log("✓", `wrote ${relative}`, quiet);
  return "written";
}

function describeDetection(report) {
  const label = {
    new: "NEW repository",
    shell: "EXISTING module — Shell / host",
    "remote-module": "EXISTING module — frontend remote",
    "shared-ui": "EXISTING package — shared UI",
    "backend-api": "EXISTING module — backend API",
    unclassified: "UNCLASSIFIED repository"
  }[report.kind];

  heading("1. Detection");
  log("→", `repository: ${report.cwd}`);
  log("→", `verdict:    ${label}`);

  for (const reason of report.reasons) log("·", reason);
  if (report.evidence.length) {
    log("·", "evidence:");
    for (const item of report.evidence) log(" ", `- ${item}`);
  }

  if (report.federation.exposes.length) {
    log("·", `exposes: ${report.federation.exposes.map((e) => e.key).join(", ")}`);
  }
  if (report.federation.remotes.length) {
    log("·", `consumes remotes: ${report.federation.remotes.join(", ")}`);
  }

  return label;
}

/**
 * Intake answers that a later run must not be asked to invent again.
 *
 * A repository's identity is established once. Re-running the installer after
 * scaffolding must not ask which slug the module has — and more importantly,
 * must not *derive* a different one, because the derived value names the two
 * repositories and the object-storage bucket. Deriving `module_fe` where the
 * first run wrote `module_demo_fe` creates a second pair of repositories
 * nobody asked for, in the same directory, and the answer is only visible
 * several lines into the output.
 */
const CARRY_FORWARD = [
  "SCOPE_KIND",
  "MODULE_KIND",
  "MODULE_NAME",
  "MODULE_DISPLAY",
  "MODULE_SLUG",
  "SCAFFOLD",
  "SUBMODULES",
  "USE_CASE",
  "BLAST_RADIUS",
  "ROUTE_PREFIX",
  "ROLE_KEY",
  "REMOTE_PORT",
  "BACKEND_PORT",
  "API_BASES",
  "SHELL_REPO",
  "UI_DEPENDENCY",
  "REPO_NAME",
  "OWNER",
  "DEPLOY_TARGET"
];

/** Flag name → answer key, so a flag applies even when its question does not run. */
const FLAG_KEYS = {
  scope: "SCOPE_KIND",
  kind: "MODULE_KIND",
  module: "MODULE_NAME",
  display: "MODULE_DISPLAY",
  slug: "MODULE_SLUG",
  parts: "SCAFFOLD",
  submodule: "SUBMODULES",
  usecase: "USE_CASE",
  "route-prefix": "ROUTE_PREFIX",
  role: "ROLE_KEY",
  port: "REMOTE_PORT",
  "backend-port": "BACKEND_PORT",
  apis: "API_BASES",
  shell: "SHELL_REPO",
  "ui-dep": "UI_DEPENDENCY",
  "blast-radius": "BLAST_RADIUS",
  name: "REPO_NAME",
  owner: "OWNER",
  deploy: "DEPLOY_TARGET",
  "confirm-identity": "CONFIRM_IDENTITY"
};

/** Flags that change behaviour rather than answer a question. */
const BEHAVIOUR_FLAGS = new Set([
  "force",
  "yes",
  "dry-run",
  "check",
  "uninstall",
  "quiet",
  "help",
  "self",
  "no-readme",
  "minio",
  "bucket"
]);

function readPreviousInstall(cwd) {
  const file = path.join(cwd, skills.DOCS_DIR, "install.json");
  if (!fs.existsSync(file)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    return state && state.context ? state.context : null;
  } catch (err) {
    return null;
  }
}

async function runIntake(report, flags, quiet) {
  const flow = skills.buildFlow(report);
  const interactive = Boolean(flags.yes) ? false : process.stdin.isTTY;
  const prompter = createPrompter({ interactive });

  const context = {
    flags,
    detected: report,
    flow: flow.flow,
    _answers: {}
  };

  // An explicit flag wins over everything, including what a previous install
  // recorded: it is the one value in this run that somebody typed on purpose.
  for (const [flag, key] of Object.entries(FLAG_KEYS)) {
    if (flags[flag] !== undefined && context[key] === undefined) context[key] = flags[flag];
  }

  // What the repository already is, seeded before the questions run so a
  // question's own default can be phrased in terms of it. A question that
  // produces a real answer overwrites this; one that has no answer — which in a
  // non-interactive re-run is most of them — leaves it standing, and that is
  // the point: re-rendering the governance tree with `{{USE_CASE}}` where a
  // sentence used to be is a regression, not an honest hole.
  const previous = readPreviousInstall(report.cwd);
  if (previous) {
    for (const key of CARRY_FORWARD) {
      const value = previous[key];
      if (value === undefined || value === null || value === "") continue;
      if (context[key] !== undefined) continue;
      context[key] = value;
    }
  }

  if (!quiet) {
    heading(`2. Intake — ${flow.flow === "new" ? "new repository" : "existing module"}`);
    if (flow.flow === "new") {
      log("→", "Nothing exists yet, so we establish the module identity first.");
    } else {
      log("→", "An existing module was detected; identity is pre-filled, confirm it.");
    }
    log("→", "Nothing happens until these are answered. No file is written yet.");
    console.log("");
  }

  for (const question of flow.questions) {
    const answer = await prompter.ask(question, context);
    // `undefined` means "no answer available", which the renderer turns into a
    // visible `{{TOKEN}}`. That is the intended outcome, not a silent blank.
    if (answer === undefined) continue;
    context[question.key] = answer;
  }

  prompter.close();

  /*
   * What this run is keeping, and what it is replacing.
   *
   * Priority is explicit → remembered → derived. A flag or a typed answer wins
   * outright: that is somebody saying otherwise, now. A value from the previous
   * install beats a derived default, because a default is a guess about a
   * repository whose real answer is already recorded — `path.basename(cwd)`
   * as the repository name is right exactly once, on the run that created the
   * directory, and every run after that would rename the module by accident.
   */
  const sourceByKey = new Map();
  for (const entry of prompter.asked) sourceByKey.set(entry.key, entry.source);

  const carried = [];
  if (previous) {
    for (const key of CARRY_FORWARD) {
      const remembered = previous[key];
      if (remembered === undefined || remembered === null || remembered === "") continue;
      const source = sourceByKey.get(key);
      if (source === "flag" || source === "prompt") continue;
      if (context[key] !== remembered) context[key] = remembered;
      carried.push(key);
    }
  }

  if (carried.length) {
    log("→", `carried from the previous install: ${carried.join(", ")}`, quiet);
  }

  // A flag that maps to nothing this intake knows about is the only kind of
  // mistake worth printing here. Every other flag either answers a question in
  // this flow or is applied to the context directly, so calling those "unused"
  // would be false — `--parts`, for instance, governs the scaffold and the README
  // step rather than a question, and `--blast-radius` still lands in the context
  // in a flow that never asks it.
  const claimed = new Set(flow.questions.map((question) => question.flag).filter(Boolean));
  const unknown = Object.keys(flags).filter(
    (flag) => !claimed.has(flag) && !BEHAVIOUR_FLAGS.has(flag) && !Object.prototype.hasOwnProperty.call(FLAG_KEYS, flag)
  );
  if (unknown.length) {
    log("!", `flag(s) this intake does not recognise: ${unknown.join(", ")}`, quiet);
  }

  const carriedKeys = new Set(carried);
  const asked = [
    ...prompter.asked.filter((entry) => !carriedKeys.has(entry.key)),
    ...carried.map((key) => ({ key, source: "previous install", value: context[key] }))
  ];

  // A question reported as unanswered whose value the previous install supplied
  // is not unresolved — printing it as such would send someone to fill in a
  // placeholder that is already a real value two lines further down.
  const missing = prompter.missing.filter((key) => {
    const value = context[key];
    return value === undefined || value === null || value === "" || value === skills.UNANSWERED;
  });

  for (const key of missing) {
    log("!", `${key} is unresolved — it will be written as {{${key}}}`, quiet);
  }

  return { context: skills.buildContext(report, context), flow: flow.flow, asked };
}

/**
 * Which generated tables this repository's README carries.
 *
 * A frontend module documents the routes the Shell will register; a backend
 * service documents the endpoints it answers. The Shell and the shared UI
 * package get neither — a table of routes read out of an empty scan would be
 * invented, and an invented table is worse than none.
 */
function readmeModes(context, report) {
  const parts = context.SCAFFOLD || "docs";
  const kind = context.MODULE_KIND || report.kind;
  const modes = [];
  const push = (mode) => {
    if (!modes.includes(mode)) modes.push(mode);
  };

  if (parts === "both" || parts === "frontend") push("routes");
  if (parts === "both" || parts === "backend") push("api");
  if (parts === "docs") {
    if (kind === "remote-module") push("routes");
    if (kind === "backend-api") push("api");
  }
  return modes;
}

/**
 * Where a generated table belongs.
 *
 * A frontend module documents the routes the Shell will register, and that
 * README is `<slug>_fe/README.md` — not the workspace's. A backend service
 * documents the endpoints it answers, and that README is `<slug>_be/README.md`.
 * Falling back to the current directory keeps the rule true for a single
 * repository install, where the repository *is* the module.
 */
function readmeTarget(mode, cwd, context) {
  const repository = mode === "api" ? context.BACKEND_REPO : context.FRONTEND_REPO;
  const candidate = repository ? path.join(cwd, repository) : cwd;
  return fs.existsSync(candidate) ? candidate : cwd;
}

/**
 * Rows for one table, read from the repository that actually holds them. For a
 * `module-pair` workspace that means the frontend table comes from
 * `<slug>_fe` and the API table from `<slug>_be`, never from the workspace
 * directory, which contains neither.
 */
function rowsFor(mode, root, context) {
  const detected = mode === "api" ? readmeLib.detectApis(root) : readmeLib.detectRoutes(root);
  if (detected.length) return detected;
  return mode === "api" ? readmeLib.derivedApis(context) : readmeLib.derivedRoutes(context);
}

async function runReadmeStep({ context, report, flags, dryRun, quiet }) {
  const state = {};

  if (flags["no-readme"]) {
    log("–", "README left untouched (--no-readme)", quiet);
    return state;
  }

  const modes = readmeModes(context, report);
  if (!modes.length) return state;

  heading("6. README");

  for (const mode of modes) {
    const target = readmeTarget(mode, report.cwd, context);
    const rows = rowsFor(mode, target, context);
    const block = readmeLib.render(mode, rows);
    const where = path.relative(report.cwd, path.join(target, readmeLib.README_NAME));

    if (dryRun) {
      log("○", `would write the ${mode} table to ${where} (${rows.length} rows)`, quiet);
      state[mode] = { action: "dry", rows: rows.length, path: where.split(path.sep).join("/") };
      continue;
    }

    const outcome = readmeLib.updateReadme(target, mode, block);
    state[mode] = {
      action: outcome.action,
      rows: rows.length,
      path: path.relative(report.cwd, outcome.file).split(path.sep).join("/"),
      // Uninstall needs to know whether *we* created the file: deleting a
      // README a developer wrote in order to hold a table of ours would be
      // removing their work under our marker.
      created: outcome.action === "created"
    };

    const messages = {
      created: `created ${where} with the ${mode} table (${rows.length} rows)`,
      appended: `appended the ${mode} table to ${where} (${rows.length} rows)`,
      refreshed: `refreshed the ${mode} table in ${where} (${rows.length} rows)`,
      unchanged: `${mode} table in ${where} already current`
    };
    log(outcome.action === "unchanged" ? "–" : "✓", messages[outcome.action] || outcome.action, quiet);
  }

  return state;
}

/**
 * The two repositories a new module is made of.
 *
 * The same `writeFileSafe` rules apply as to the governance tree: a file that
 * already exists is kept, and `--force` backs it up first. Scaffolding is not a
 * special case where the installer overwrites a repository a developer has
 * already started.
 */
function runScaffoldStep({ context, report, flags, dryRun, quiet }) {
  const parts = context.SCAFFOLD || "docs";
  if (parts === "docs") return { hashes: {}, files: [], repositories: [], unresolvedTokens: [], unresolvedPaths: [] };

  heading("5. Scaffold");
  const plan = scaffoldLib.plan(context);
  const hashes = {};

  for (const file of plan.files) {
    const target = path.join(report.cwd, file.relative);
    const status = writeFileSafe(target, file.content, {
      force: Boolean(flags.force),
      dryRun,
      quiet
    });

    // A file this run refused to overwrite still counts as ours while it is
    // byte-identical to what the scaffold produced. Recording the hash only for
    // files we actually wrote would empty the record on every re-install — the
    // common case — and uninstall would then have nothing to compare against
    // and would keep every scaffolded file forever.
    let matches = status === "written";
    if (!matches && !dryRun) {
      try {
        matches = fs.readFileSync(target, "utf8") === file.content;
      } catch (err) {
        matches = false;
      }
    }
    if (matches) hashes[file.relative] = sha256(file.content);
  }

  if (plan.unresolvedPaths.length) {
    log("!", "skipped files whose path could not be resolved:", quiet);
    for (const entry of plan.unresolvedPaths) log(" ", entry, quiet);
  }

  log("→", `${plan.files.length} file(s) across ${plan.repositories.length} repositories: ${plan.repositories.join(", ")}`, quiet);
  return { ...plan, hashes };
}

/** Ask once, in a terminal, and never in a pipeline. */
async function askInstallMinio(flags) {
  if (!process.stdin.isTTY || flags.yes) return false;
  const prompter = createPrompter({ interactive: true });
  const answer = await prompter.ask(
    {
      key: "MINIO_INSTALL",
      type: "confirm",
      prompt: "No MinIO is running locally. Start one in Docker and create this module's bucket?",
      default: () => true
    },
    {}
  );
  prompter.close();
  return answer === true;
}

/**
 * Reach object storage, and make sure this module's bucket exists.
 *
 * The three rules this step follows:
 *
 *   - it installs only on explicit consent — an `--minio=install` flag or a
 *     yes at the prompt. A non-interactive run with no flag prints commands
 *     instead, because a pipeline cannot grant permission on anyone's behalf.
 *   - it never invents a bucket name. The bucket is the module slug, or
 *     `--bucket`, and the service reads the same value from its own `.env`.
 *   - it always reports what it did and what it could not do. An install that
 *     silently half-succeeded leaves a service that fails on its first upload.
 */
async function runMinioStep({ context, report, flags, dryRun, quiet }) {
  // The heading comes first whatever the outcome. A skipped section that prints
  // nothing leaves the numbered steps running 6 → 8, and a reader reasonably
  // concludes a step failed rather than that it declined to run.
  heading("7. MinIO");

  const rawPolicy = typeof flags.minio === "string" ? flags.minio.trim().toLowerCase() : null;
  if (rawPolicy === "skip") {
    log("–", "skipped (--minio=skip)", quiet);
    return { skipped: true };
  }

  const explicit = rawPolicy !== null && rawPolicy !== "";
  const parts = context.SCAFFOLD || "docs";
  const kind = context.MODULE_KIND || report.kind;
  const backendHere = parts === "both" || parts === "backend" || kind === "backend-api";
  if (!explicit && !backendHere) {
    log("–", "no backend in this install — nothing to store, no bucket to create", quiet);
    return null;
  }

  const bucket = String(flags.bucket || context.BUCKET || "").trim();
  if (!bucket) {
    log("–", "no module slug, so no bucket name — nothing to do", quiet);
    return null;
  }

  const endpoint = process.env.MINIO_ENDPOINT || context.MINIO_ENDPOINT || minioLib.DEFAULT_ENDPOINT;
  const policy = explicit ? rawPolicy : "auto";
  const state = { endpoint, bucket, policy };

  const status = await minioLib.detect({ endpoint });
  state.detect = { running: status.running, reason: status.reason, docker: status.docker };

  if (status.running) {
    log("✓", `MinIO reachable at ${endpoint}`);
    if (dryRun) {
      log("○", `would ensure bucket ${bucket}`);
      state.action = "dry";
      return state;
    }
    const bucketResult = await minioLib.ensureBucket(bucket, { endpoint });
    state.bucketResult = { ok: bucketResult.ok, status: bucketResult.status, existed: bucketResult.existed };
    if (bucketResult.ok) {
      log(bucketResult.existed ? "=" : "+", `bucket ${bucket} ${bucketResult.existed ? "already present" : "created"}`, quiet);
    } else {
      log("!", `bucket ${bucket} not confirmed (${bucketResult.status}): ${bucketResult.body}`, quiet);
    }
    return state;
  }

  log("!", `no MinIO at ${endpoint} — ${status.reason}`, quiet);

  let install = policy === "install";
  if (policy === "auto") {
    install = await askInstallMinio(flags);
  }

  if (dryRun) {
    log("○", install ? "would start MinIO in Docker and create the bucket" : "would print the install commands", quiet);
    state.action = "dry";
    return state;
  }

  if (!install) {
    if (policy === "auto" && !process.stdin.isTTY) {
      log("→", "non-interactive run — not installing anything. Pass --minio=install to let it.", quiet);
    }
    log("→", "to start MinIO and create the bucket by hand:", quiet);
    for (const line of minioLib.instructions(bucket, { endpoint }).split("\n")) console.log(`      ${line}`);
    state.action = "instructions";
    return state;
  }

  log("→", "starting MinIO in Docker…", quiet);
  const started = await minioLib.install({ endpoint });
  state.install = { ok: started.ok, step: started.step, detail: started.detail, container: started.container };
  if (!started.ok) {
    log("✗", `MinIO did not start at ${started.step}: ${started.detail}`, quiet);
    log("→", "run it by hand:", quiet);
    for (const line of minioLib.instructions(bucket, { endpoint }).split("\n")) console.log(`      ${line}`);
    return state;
  }

  log("✓", started.detail, quiet);
  const bucketResult = await minioLib.ensureBucket(bucket, { endpoint });
  state.bucketResult = { ok: bucketResult.ok, status: bucketResult.status, existed: bucketResult.existed };
  if (bucketResult.ok) {
    log("+", `bucket ${bucket} ready`, quiet);
  } else {
    log("!", `bucket ${bucket} not confirmed (${bucketResult.status}): ${bucketResult.body}`, quiet);
    log("→", "create it by hand:", quiet);
    for (const line of minioLib.instructions(bucket, { endpoint }).split("\n")) console.log(`      ${line}`);
  }
  return state;
}

function renderPlan(context, report) {
  const agentsTemplate = skills.collectAgentsTemplate();
  if (!agentsTemplate) {
    throw new Error(`templates/${skills.AGENTS_FILENAME} is missing from the package`);
  }

  const agents = skills.render(agentsTemplate, context);
  const governance = skills.renderTree(skills.collectGovernanceTemplates(), context);

  const unresolved = skills.reportableTokens(
    [...new Set([...agents.unresolved, ...governance.unresolved])].sort()
  );
  const missing = skills.manifest().files.filter((f) => !f.exists);

  return { agents, governance, unresolved, missing };
}

function printSummary(result, context, flow, written, quiet) {
  const total = Object.values(written).filter((v) => v === "written").length;
  const kept = Object.values(written).filter((v) => v === "kept").length;

  if (!quiet) {
    heading("8. Result");
    log("→", `flow: ${flow}`);
    log("→", `module: ${context.MODULE_NAME} (${context.MODULE_DISPLAY}) · ${context.SCOPE_KIND}`);
    log("→", `files: ${total} written, ${kept} kept`);
    if (context.MODULE_SLUG) {
      log("→", `slug: ${context.MODULE_SLUG} → bucket ${context.MODULE_SLUG}, repos ${context.FRONTEND_REPO} / ${context.BACKEND_REPO}`);
    }

    if (result.missing.length) {
      log("!", `package is missing ${result.missing.length} template file(s): ${result.missing.map((f) => f.path).join(", ")}`);
    }

    if (result.unresolved.length) {
      log("!", "unresolved placeholders — search and fill these in:");
      for (const token of result.unresolved) log(" ", `{{${token}}}`);
    }
  }

  console.log("\n  Next");
  console.log("    1. Fill the {{PLACEHOLDER}} values listed above (grep for '{{').");
  console.log("    2. Read .docs/project-governance/README.md to learn the pipeline.");
  console.log("    3. Open AGENTS.md — every AI agent reads it before touching this repository.");
  if (context.SCAFFOLD && context.SCAFFOLD !== "docs") {
    console.log("    4. Scaffolded repositories are raw: cd into each and run npm install / mvn verify.");
  }
  console.log("");
}

async function main() {
  const argv = process.argv.slice(2);
  const { flags } = parseArgs(argv);
  const quiet = Boolean(flags.quiet);

  if (flags.help) {
    console.log(HELP);
    return;
  }

  if (flags.uninstall) {
    require("./uninstall.js").run({ quiet });
    return;
  }

  if (flags.check) {
    require("./check.js").run({ quiet });
    return;
  }

  const report = skills.detect(process.cwd());
  const detectedLabel = describeDetection(report);

  const { context, flow, asked } = await runIntake(report, flags, quiet);

  heading("3. Plan");
  // The install date is the one value only the installer can know.
  context.INSTALL_DATE = new Date().toISOString().slice(0, 10);
  const result = renderPlan(context, report);
  const dryRun = Boolean(flags["dry-run"]);

  if (dryRun) {
    log("○", `dry run — nothing written. ${result.governance.files ? Object.keys(result.governance.files).length : 0} documents would be rendered.`, quiet);
  }

  heading("4. Governance");
  const written = {};
  const hashes = {};
  /**
   * Record the hash of a file this run produced — or of an existing file that
   * is byte-identical to it.
   *
   * The second half matters more than it looks. A re-install overwrites
   * `.docs/install.json`, so hashing only what this run wrote would erase the
   * record of everything it *kept*; uninstall would then read every document as
   * hand-edited and back up the whole tree instead of removing it. The hash is
   * of the content as installed, which is what makes "was this edited
   * afterwards?" answerable on any run, not just the first.
   */
  const recordHash = (target, content, status, key) => {
    if (dryRun) return;
    let matches = status === "written";
    if (!matches) {
      try {
        matches = fs.readFileSync(target, "utf8") === content;
      } catch (err) {
        matches = false;
      }
    }
    if (matches) hashes[key] = sha256(content);
  };

  const agentsPath = path.join(report.cwd, skills.AGENTS_FILENAME);
  written.agents = writeFileSafe(
    agentsPath,
    result.agents.text,
    { force: Boolean(flags.force), dryRun, quiet }
  );
  recordHash(agentsPath, result.agents.text, written.agents, skills.AGENTS_FILENAME);

  const docsRoot = path.join(report.cwd, skills.GOVERNANCE_DIR);
  for (const [relative, content] of Object.entries(result.governance.files)) {
    const target = path.join(docsRoot, relative);
    written[relative] = writeFileSafe(target, content, {
      force: Boolean(flags.force),
      dryRun,
      quiet
    });
    recordHash(target, content, written[relative], relative);
  }

  const scaffoldState = runScaffoldStep({ context, report, flags, dryRun, quiet });
  const readmeState = await runReadmeStep({ context, report, flags, dryRun, quiet });
  const minioState = await runMinioStep({ context, report, flags, dryRun, quiet });

  // A scaffolded file that could not be named is a file that was not written,
  // and its placeholder is a real hole in the repository, not a convention —
  // so it joins the governance tree's list rather than getting its own warning.
  if (scaffoldState.unresolvedTokens && scaffoldState.unresolvedTokens.length) {
    result.unresolved = skills.reportableTokens(
      [...new Set([...result.unresolved, ...scaffoldState.unresolvedTokens])].sort()
    );
  }

  // A machine-readable record of the install, so `dreams-ai-skills-check` and a
  // later re-install can tell what the installer believed, without re-deriving
  // it from prose the user has since edited.
  const statePath = path.join(report.cwd, skills.DOCS_DIR, "install.json");
  if (!dryRun) {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(
      statePath,
      `${JSON.stringify(
        {
          marker: skills.MARKER,
          version: skills.VERSION,
          installedAt: new Date().toISOString(),
          detection: { kind: report.kind, reasons: report.reasons, evidence: report.evidence },
          flow,
          context,
          answers: asked,
          hashes,
          readme: readmeState,
          scaffold: {
            parts: scaffoldState.parts || "docs",
            repositories: scaffoldState.repositories || [],
            hashes: scaffoldState.hashes || {},
            unresolvedPaths: scaffoldState.unresolvedPaths || []
          },
          minio: minioState
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    log("✓", `wrote ${path.relative(report.cwd, statePath)}`, quiet);
  }

  if (!quiet && flags.force) {
    log("→", "forced overwrite — every replaced file has a .bak next to it");
  }

  printSummary(result, context, flow, written, quiet);
  void detectedLabel;
}

main().catch((err) => {
  console.error(`\n  ✗ ${err.message}`);
  if (process.env.DREAMS_SKILLS_DEBUG) console.error(err.stack);
  process.exit(1);
});

module.exports = { parseArgs };
