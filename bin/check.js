#!/usr/bin/env node

"use strict";

/**
 * dreams-ai-skills-check — verify an installed governance tree.
 *
 * The point is to fail before an AI agent starts working, not after it has
 * already relied on a document that describes a route prefix nobody registered.
 * The check is cheap and offline: it reads the repository and the generated
 * files, and reports four classes of problem.
 *
 * Exit code 0 means healthy. Anything else is a printed list.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const skills = require("../index.js");

function findRepositoryRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, skills.GOVERNANCE_DIR))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * `{{TOKEN}}` and `{{PLACEHOLDER}}` are the documents' own examples of the
 * convention, not values to fill — `skills.reportableTokens` filters them out of
 * every report.
 */
async function run({ quiet = false, self = false } = {}) {
  const log = (icon, message) => {
    if (!quiet) console.log(`  ${icon} ${message}`);
  };
  const problems = [];
  const warnings = [];

  if (self) return selfCheck(log);
  const cwd = process.cwd();
  const root = findRepositoryRoot(cwd) || cwd;
  const docsRoot = path.join(root, skills.GOVERNANCE_DIR);
  const installed = fs.existsSync(docsRoot);

  if (!installed) {
    problems.push(
      `no governance tree at ${path.relative(cwd, docsRoot) || skills.GOVERNANCE_DIR} — run: npx -y ${skills.MARKER}`
    );
    report(problems, warnings, quiet);
    process.exitCode = 1;
    return;
  }

  /* 1. Structure ---------------------------------------------------- */

  const expected = skills.manifest().files.map((f) => f.path);
  const missing = expected.filter((rel) => !fs.existsSync(path.join(docsRoot, rel)));
  if (!fs.existsSync(path.join(docsRoot, "README.md"))) missing.push("README.md");
  if (missing.length) problems.push(`missing document(s): ${missing.join(", ")}`);
  else log("✓", `${expected.length + 1}/${expected.length + 1} governance documents present`);

  /* 2. Router ------------------------------------------------------- */

  const agentsPath = path.join(root, skills.AGENTS_FILENAME);
  if (!fs.existsSync(agentsPath)) {
    problems.push(`missing ${skills.AGENTS_FILENAME} at the repository root`);
  } else {
    const agents = fs.readFileSync(agentsPath, "utf8");
    if (!agents.includes(skills.MARKER)) {
      warnings.push(`${skills.AGENTS_FILENAME} has no "${skills.MARKER}" marker — uninstall will not touch it`);
    }
    const refs = [...agents.matchAll(/\.docs\/project-governance\/([A-Za-z0-9._/-]+\.md)/g)].map((m) => m[1]);
    const dangling = [...new Set(refs)].filter(
      (rel) => !fs.existsSync(path.join(docsRoot, rel)) && !/[{*]/.test(rel)
    );
    if (dangling.length) problems.push(`${skills.AGENTS_FILENAME} references missing document(s): ${dangling.join(", ")}`);
    else log("✓", `${skills.AGENTS_FILENAME} references resolve (${new Set(refs).size} links)`);
  }

  /* 3. Identity vs reality ------------------------------------------ */

  const statePath = path.join(root, skills.DOCS_DIR, "install.json");
  let state = null;
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch (err) {
      warnings.push(`.docs/install.json is not valid JSON: ${err.message}`);
    }
  } else {
    warnings.push("no .docs/install.json — the recorded intake answers are unavailable");
  }

  const detection = skills.detect(root);

  if (state && state.context) {
    const ctx = state.context;
    const fedName = detection.federation.name;
    if (fedName && ctx.FEDERATION_NAME && fedName !== ctx.FEDERATION_NAME) {
      problems.push(
        `federation name drift: vue.config.js declares "${fedName}" but the governance tree documents "${ctx.FEDERATION_NAME}"`
      );
    }
    const shared = detection.federation.shared || [];
    if (ctx.SHARED_SINGLETONS && shared.length) {
      const documented = ctx.SHARED_SINGLETONS.split(",").map((s) => s.trim()).filter(Boolean);
      const missing = shared.filter((name) => !documented.includes(name));
      if (missing.length) {
        problems.push(
          `shared singleton drift: vue.config.js shares ${shared.join(", ")} but the governance tree documents only "${ctx.SHARED_SINGLETONS}" — a duplicated singleton is a runtime crash, not a lint error`
        );
      }
    }
    const metaName = detection.metadata && detection.metadata.remoteName;
    if (metaName && ctx.MODULE_NAME && metaName !== ctx.MODULE_NAME) {
      problems.push(
        `metadata drift: ${detection.metadata.file} declares remoteName "${metaName}" but the governance tree documents "${ctx.MODULE_NAME}"`
      );
    }
    if (detection.ui.dependency && ctx.UI_DEPENDENCY && detection.ui.dependency !== ctx.UI_DEPENDENCY) {
      warnings.push(
        `@2enapps/ui is "${detection.ui.dependency}" but 03-architecture/ARCHITECTURE.md was written for "${ctx.UI_DEPENDENCY}"`
      );
    }
    if (state.detection && state.detection.kind && detection.kind && state.detection.kind !== detection.kind) {
      // A `module-pair` install records `new` — nothing existed when the intake
      // ran — and the directories it then created are what classifies it now.
      // Reporting that as drift would tell every freshly scaffolded workspace
      // to re-run an installer that did exactly what was asked of it.
      const scaffoldedPair =
        state.detection.kind === "new" && detection.kind === "module-pair" && state.context && state.context.MODULE_KIND === "module-pair";
      const collapsedPair =
        detection.kind === "new" && state.detection.kind === "module-pair";
      if (!scaffoldedPair && !collapsedPair) {
        warnings.push(
          `the repository classified as "${detection.kind}" now, but the install recorded "${state.detection.kind}" — re-run the installer if the repository's role changed`
        );
      }
    }
    if (!problems.length) log("✓", "documented identity matches the repository");
  }

  /* 4. Unresolved placeholders -------------------------------------- */

  const placeholders = new Map();
  for (const rel of expected) {
    const file = path.join(docsRoot, rel);
    if (!fs.existsSync(file)) continue;
    for (const token of skills.reportableTokens(skills.collectTokens(fs.readFileSync(file, "utf8")))) {
      if (!placeholders.has(token)) placeholders.set(token, []);
      placeholders.get(token).push(rel);
    }
  }
  if (placeholders.size) {
    warnings.push(
      `${placeholders.size} unresolved placeholder(s) remain: ${[...placeholders.keys()].map((t) => `{{${t}}}`).join(", ")}`
    );
  } else {
    log("✓", "no unresolved placeholders");
  }

  /* 5. Pipeline order ------------------------------------------------ */

  const readme = path.join(docsRoot, "README.md");
  if (fs.existsSync(readme)) {
    const content = fs.readFileSync(readme, "utf8");
    const missingSteps = skills.PIPELINE.filter((p) => !content.includes(p.step));
    if (missingSteps.length) {
      warnings.push(`README.md does not mention pipeline step(s): ${missingSteps.map((p) => p.step).join(", ")}`);
    }
  }

  /* 6. Generated README tables -------------------------------------- */

  checkReadmeBlocks({ root, state, log, problems, warnings });

  /* 7. Uploads and object storage ----------------------------------- */

  checkStorage({ root, state, log, problems, warnings });

  /* 8. The module's own environment --------------------------------- */

  checkEnvironment({ root, state, log, problems, warnings });

  report(problems, warnings, quiet);
  process.exitCode = problems.length ? 1 : 0;
}

/* ------------------------------------------------------------------ */
/* 6. README tables                                                    */
/* ------------------------------------------------------------------ */

/**
 * A module's README carries generated tables between markers. They are the
 * only documentation anyone reads before calling an endpoint, so a table that
 * drifted from the code is worse than no table — it is believed.
 *
 * Both failure shapes are reported: markers that no longer pair (someone
 * deleted half a block), and a block whose content no longer matches what the
 * code says right now. The second is a warning, because it is normally fixed by
 * re-running the installer rather than by stopping work.
 */
function checkReadmeBlocks({ root, state, log, problems, warnings }) {
  const readmeName = skills.readme.README_NAME;
  const ctx = (state && state.context) || {};

  const directories = [root];
  const seen = new Set([root]);
  const recorded = (state && state.scaffold && state.scaffold.repositories) || [];

  for (const repository of recorded) {
    const dir = path.join(root, repository);
    if (fs.existsSync(dir) && !seen.has(dir)) {
      seen.add(dir);
      directories.push(dir);
    }
  }
  // An install that predates the scaffold record still produced `*_fe` and
  // `*_be` directories; scanning them keeps the check useful on older trees.
  for (const entry of safeReaddir(root)) {
    if (!/(_fe|_be)$/.test(entry)) continue;
    const dir = path.join(root, entry);
    if (isDirectory(dir) && !seen.has(dir)) {
      seen.add(dir);
      directories.push(dir);
    }
  }

  let blocks = 0;

  for (const dir of directories) {
    const file = path.join(dir, readmeName);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");

    for (const mode of Object.keys(skills.README_BLOCKS)) {
      const block = skills.README_BLOCKS[mode];
      const starts = content.includes(block.start);
      const ends = content.includes(block.end);
      if (!starts && !ends) continue;

      const relative = path.relative(root, file) || readmeName;
      blocks += 1;

      if (!starts || !ends || !skills.readme.blockRange(content, mode)) {
        problems.push(
          `${relative}: the ${mode} markers do not pair — ` +
            (starts ? `no \`${block.end}\`` : `no \`${block.start}\``) +
            `. The generated table cannot be refreshed or removed until they balance.`
        );
        continue;
      }

      const range = skills.readme.blockRange(content, mode);
      const current = content.slice(range.start, range.end);
      const expected = skills.readme.render(mode, observedRows(mode, dir, ctx));
      if (current !== expected) {
        warnings.push(
          `${relative}: the ${mode} table no longer matches what the repository declares — ` +
            `re-run the installer to regenerate it`
        );
      }
    }
  }

  const recordedReadme = (state && state.readme) || {};
  const expectedBlocks = Object.entries(recordedReadme).filter(
    ([, entry]) => entry && entry.action && entry.action !== "dry"
  );
  if (expectedBlocks.length && blocks === 0) {
    problems.push(
      `every generated README table is gone (the install recorded: ${expectedBlocks
        .map(([mode]) => mode)
        .join(", ")}) — re-run the installer, or uninstall and reinstall`
    );
  }

  if (blocks) log("✓", `${blocks} generated README table(s) present and paired`);
}

/**
 * The rows a block in a real repository should currently hold.
 *
 * Code first, intake second: a table that a router and a controller both
 * describe is the truth, and the derived rows are only what a fresh install sets
 * out to build. The workspace inventory has no code to read at all — it records
 * what the intake decided — so it is derived, always.
 */
function observedRows(mode, dir, ctx) {
  if (mode === "workspace") return skills.readme.derivedWorkspace(ctx);
  const detected = mode === "api" ? skills.readme.detectApis(dir) : skills.readme.detectRoutes(dir);
  if (detected.length) return detected;
  return mode === "api" ? skills.readme.derivedApis(ctx) : skills.readme.derivedRoutes(ctx);
}

/* ------------------------------------------------------------------ */
/* 7. Uploads and object storage                                       */
/* ------------------------------------------------------------------ */

/**
 * "Does this repository upload documents, and where do the files go?" is a
 * question neither the governance tree nor a human reliably answers after the
 * third commit. The signals are reported with addresses so the answer can be
 * checked rather than recalled.
 */
function checkStorage({ root, state, log, problems, warnings }) {
  const features = skills.features.detectUploads(root);
  const ctx = (state && state.context) || {};

  if (!features.detected) {
    log("·", "no upload or object-storage code found");
  } else {
    const shown = features.signals.slice(0, 4);
    const suffix = features.signals.length > shown.length ? ` (+${features.signals.length - shown.length} more)` : "";
    log("✓", `upload/storage evidence: ${features.signals.length} signal(s)${suffix}`);
    for (const signal of shown) {
      log(" ", `${signal.id} — ${signal.file}:${signal.lines.join(",")}`);
    }
    if (features.truncated) warnings.push("the storage scan hit its file limit; the list above is partial");
  }

  const backendUpload = features.signals.some((s) => s.kind === "backend");
  const frontendUpload = features.signals.some((s) => s.kind === "frontend");

  if (backendUpload && !features.hasStorage) {
    warnings.push(
      `a backend upload endpoint exists but no object-storage client was found — ` +
        `${features.signals.filter((s) => s.kind === "backend").map((s) => s.file).join(", ")} receive bytes from somewhere; ` +
        `say where in 09-backend/STORAGE.md`
    );
  }

  if (frontendUpload && !backendUpload && !features.hasStorage) {
    log("·", "uploads are driven from the frontend; the receiving service lives outside this tree");
  }

  if (features.hasStorage && !backendUpload && !frontendUpload) {
    warnings.push("an object-storage client is configured but no upload path uses it — a dead dependency");
  }

  const documented = (ctx.BUCKET || "").trim();
  if (features.buckets.length) {
    log("·", `bucket(s) in configuration: ${features.buckets.join(", ")}`);
    if (documented) {
      const foreign = features.buckets.filter((bucket) => bucket !== documented);
      if (foreign.length) {
        warnings.push(
          `bucket drift: this module documents "${documented}" but the repository also names ` +
            `${foreign.map((b) => `"${b}"`).join(", ")} — one of them belongs to another module`
        );
      }
    }
  } else if (documented && features.hasStorage) {
    warnings.push(
      `object storage is used but no bucket is configured — ${documented} is the documented one; ` +
        `set MINIO_BUCKET in the service's own .env`
    );
  }
}

/* ------------------------------------------------------------------ */
/* 8. The module's own environment                                     */
/* ------------------------------------------------------------------ */

/**
 * The rule the platform depends on: every module reads its own `.env`, and
 * nothing in it is committed. Three things break that — a `.env` that was never
 * created from the example, a value that drifted from the documented one, and
 * a `.env` a `.gitignore` no longer ignores.
 */
function checkEnvironment({ root, state, log, problems, warnings }) {
  const ctx = (state && state.context) || {};

  const directories = [root];
  for (const entry of safeReaddir(root)) {
    if (!/(_fe|_be)$/.test(entry) && !fs.existsSync(path.join(root, entry, "vue.config.js"))) continue;
    const dir = path.join(root, entry);
    if (isDirectory(dir)) directories.push(dir);
  }

  let inspected = 0;

  for (const dir of directories) {
    const envFile = path.join(dir, ".env");
    const exampleFile = path.join(dir, ".env.example");
    const relative = path.relative(root, dir) || ".";

    if (!fs.existsSync(envFile) && fs.existsSync(exampleFile)) {
      warnings.push(
        `${relative}/.env.example exists but ${relative}/.env does not — ` +
          `copy it across before starting the service`
      );
    }

    if (!fs.existsSync(envFile)) continue;
    inspected += 1;

    const values = parseEnv(fs.readFileSync(envFile, "utf8"));

    // A `.env` tracked by git is a secret in the history, and no rotation later
    // removes it from every commit that already has it.
    const gitignore = path.join(dir, ".gitignore");
    if (fs.existsSync(gitignore)) {
      const ignored = fs.readFileSync(gitignore, "utf8").split("\n").map((l) => l.trim());
      if (!ignored.some((line) => line === ".env" || line === "/.env")) {
        warnings.push(`${relative}/.gitignore does not ignore .env — it will be committed`);
      }
    } else {
      warnings.push(`${relative} has no .gitignore`);
    }

    const isBackend = fs.existsSync(path.join(dir, "pom.xml")) || fs.existsSync(path.join(dir, "build.gradle"));
    const isFrontend = fs.existsSync(path.join(dir, "vue.config.js"));
    if (isBackend) {
      if (!("MINIO_BUCKET" in values)) {
        warnings.push(
          `${relative}/.env sets no MINIO_BUCKET — the service falls back to a default; ` +
            `set it to the module bucket${ctx.BUCKET ? ` "${ctx.BUCKET}"` : ""}`
        );
      } else if (ctx.BUCKET && values.MINIO_BUCKET !== ctx.BUCKET) {
        problems.push(
          `${relative}/.env writes to bucket "${values.MINIO_BUCKET}" but this module documents ` +
            `"${ctx.BUCKET}" — uploads would land in a bucket nobody owns`
        );
      }
      if (!("MINIO_ENDPOINT" in values)) {
        warnings.push(`${relative}/.env sets no MINIO_ENDPOINT; the default is http://localhost:9000`);
      }
      if (!fs.existsSync(path.join(dir, ".env.example"))) {
        warnings.push(`${relative} has no .env.example — the next machine has no template`);
      }
    }

    if (ctx.API_BASE_ENV && isFrontend && !(ctx.API_BASE_ENV in values) && fs.existsSync(exampleFile)) {
      const exampleValues = parseEnv(fs.readFileSync(exampleFile, "utf8"));
      if (!(ctx.API_BASE_ENV in exampleValues)) {
        warnings.push(
          `${relative}/.env does not declare ${ctx.API_BASE_ENV}, the base this module documents — ` +
            `its API calls would fall back to whatever the Shell exports`
        );
      }
    }
  }

  if (inspected) log("✓", `${inspected} module .env file(s) inspected`);
}

function parseEnv(source) {
  const values = {};
  for (const line of String(source).split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return values;
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch (err) {
    return [];
  }
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (err) {
    return false;
  }
}

/**
 * No function may be declared twice in this file.
 *
 * Both were real: a second `rowsForCheck` was added with a different arity for
 * the self-check, and function hoisting made it the one every call site reached —
 * so `check` compared every README block against rows built for a different
 * directory and reported drift on a table the installer had just written. Nothing
 * failed loudly, because both callers were satisfied. Two declarations of one
 * name in one file is always a mistake, whatever the intent.
 */
function checkNoShadowedHelpers(problems, log) {
  const source = fs.readFileSync(__filename, "utf8");
  const seen = new Map();
  for (const match of source.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)) {
    const name = match[1];
    seen.set(name, (seen.get(name) || 0) + 1);
  }
  const doubled = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  if (doubled.length) {
    problems.push(`bin/check.js declares ${doubled.join(", ")} more than once — the later one silently wins`);
  }
  log("✓", `no shadowed helper in bin/check.js (${seen.size} functions)`);
}

/**
 * The package README is the first thing anybody reads, and a flag it does not
 * mention is a flag nobody uses.
 *
 * The levels are checked against `LEVELS` rather than a hardcoded list, so
 * renaming one breaks here instead of quietly leaving two documents disagreeing.
 */
function checkDocs(problems, log) {
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");

  for (const flag of [
    "--level",
    "--no-review",
    "--yes",
    "--dry-run",
    "--force",
    "--check",
    "--uninstall",
    "--quiet",
    "--minio",
    "--bucket",
    "--no-readme"
  ]) {
    if (!readme.includes(flag)) problems.push(`the package README never mentions ${flag}`);
  }

  for (const level of skills.LEVELS) {
    if (!readme.includes(level.label)) problems.push(`the package README never mentions the ${level.label} level`);
    if (!readme.includes(String(level.digit))) {
      problems.push(`the package README never shows the digit for ${level.label}`);
    }
  }

  // The claim that a level never shrinks the tree is the one that must be
  // written down, because it is the one a reader cannot check by looking.
  if (!/never (shrinks|removes) the governance tree|never a governance document/i.test(readme)) {
    problems.push("the package README does not say that a level never shrinks the governance tree");
  }

  // The three documented counts, cross-checked against the plan for a
  // one-sub-module module pair — the shape the README's table describes.
  const context = syntheticContext();
  context.SUBMODULES = "program/senarai-program";
  const counts = ["economy", "recommended", "full"].map(
    (level) => skills.scaffold.plan(context, { level }).files.length
  );
  for (const count of counts) {
    if (!readme.includes(`**${count}**`)) {
      problems.push(`the package README does not state the ${count}-file scaffold for a level`);
    }
  }
  if (counts[0] >= counts[1] || counts[1] >= counts[2]) {
    problems.push(`the documented scaffold counts are not increasing: ${counts.join(" / ")}`);
  }

  log("✓", `package README documents the three levels, ${counts.join(" / ")} scaffold files, and every behaviour flag`);
}

/** `--self` validates the package itself, so `npm test` is meaningful. */
async function selfCheck(log) {
  const problems = [];

  const manifest = skills.manifest();
  const missing = manifest.files.filter((f) => !f.exists);
  const readmePath = path.join(__dirname, "..", "templates", skills.GOVERNANCE_SUBDIR, "README.md");
  if (!fs.existsSync(readmePath)) missing.push({ path: "README.md" });
  if (missing.length) problems.push(`templates missing: ${missing.map((f) => f.path).join(", ")}`);
  else log("✓", `${manifest.files.length + 1} template documents present`);

  const sections = new Set(manifest.files.map((f) => f.section));
  if (sections.size !== skills.SECTIONS.length) {
    problems.push(`expected ${skills.SECTIONS.length} sections, found ${sections.size}`);
  }

  const agents = skills.collectAgentsTemplate();
  if (!agents) problems.push("templates/AGENTS.md is missing");
  else {
    if (!agents.includes(skills.MARKER)) problems.push("templates/AGENTS.md has no marker");
    const refs = [...agents.matchAll(/\.docs\/project-governance\/([A-Za-z0-9._/-]+\.md)/g)].map((m) => m[1]);
    const known = new Set([...manifest.files.map((f) => f.path), "README.md"]);
    const dangling = [...new Set(refs)].filter((rel) => !known.has(rel) && !/[{*]/.test(rel));
    if (dangling.length) problems.push(`AGENTS.md references unknown documents: ${dangling.join(", ")}`);
    else log("✓", `AGENTS.md references ${new Set(refs).size} documents, all known`);
  }

  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  const missingSteps = skills.PIPELINE.filter((p) => !readme.includes(p.step));
  if (missingSteps.length) problems.push(`governance README misses pipeline step(s): ${missingSteps.map((p) => p.step).join(", ")}`);
  else log("✓", "governance README documents every pipeline step");

  // The governance README is where somebody lands who wants to know whether an
  // agent is allowed to continue on its own. It has to say no.
  if (!/human sign-off/i.test(readme)) {
    problems.push("the governance README does not require a human sign-off between stages");
  }

  const sample = skills.render("{{MODULE_NAME}} / {{ROUTE_PREFIX}}", { MODULE_NAME: "v2t", ROUTE_PREFIX: "/v2t" });
  if (sample.text !== "v2t / /v2t") problems.push("renderer does not substitute correctly");
  const missingTok = skills.render("{{NOPE}}", {});
  if (missingTok.text !== "{{NOPE}}" || !missingTok.unresolved.includes("NOPE")) {
    problems.push("renderer does not preserve unresolved tokens");
  }
  log("✓", "renderer substitutes and preserves correctly");

  checkScaffoldTemplates(problems, log);
  checkNoShadowedHelpers(problems, log);
  checkDocs(problems, log);
  await checkScaffoldLevels(problems, log);
  await checkReviewGates(problems, log);
  checkScaffoldGates(problems, log);
  checkIntakeTiers(problems, log);
  checkSignOffContract(agents, problems, log);
  checkReadmeRendering(problems, log);
  checkMinioSurface(problems, log);

  report(problems, [], false);
  process.exitCode = problems.length ? 1 : 0;
}

/**
 * The human sign-off rule has to be in the file every agent reads first, and it
 * has to say something an agent cannot talk its way past.
 *
 * The wording is a judgement call, but the presence of these four things is not:
 * a stage gate, a person, a record, and a prohibition on self-approval. A file
 * that says "get approval" without saying what counts as approval is the version
 * agents wave through.
 */
function checkSignOffContract(agents, problems, log) {
  if (!agents) return;
  const required = [
    { test: /sign-off/i, why: "the phrase 'sign-off' — the gate has to be nameable to be enforced" },
    { test: /human/i, why: "a named person, not an agent" },
    { test: /self-approve/i, why: "an explicit prohibition on the agent approving its own work" },
    { test: /silence is not a yes/i, why: "a statement that silence is not approval" }
  ];
  for (const rule of required) {
    if (!rule.test.test(agents)) problems.push(`templates/AGENTS.md is missing ${rule.why}`);
  }

  // The installer's own levels have to be described where an agent will look for
  // them, or the agent picks a level without knowing what it costs.
  for (const fragment of ["Recommended", "Economy", "Full"]) {
    if (!agents.includes(fragment)) problems.push(`templates/AGENTS.md does not document the ${fragment} level`);
  }
  if (!/never removes a document|never a smaller|always/i.test(agents)) {
    problems.push("templates/AGENTS.md does not say that a level never shrinks the governance tree");
  }

  log("✓", "AGENTS.md carries the human sign-off gate and the three review levels");
}

/**
 * A full `module-pair` context, standing in for an intake nobody performs here.
 * Everything below is checked against *this* exact shape, so a change that
 * breaks the scaffold breaks `npm test` rather than a user's directory.
 */
function syntheticContext() {
  const detected = {
    kind: "new",
    isNew: true,
    cwd: process.cwd(),
    federation: { name: "" },
    metadata: {},
    ui: {},
    env: {},
    package: {},
    backend: {},
    hasDocs: false
  };

  return skills.buildContext(detected, {
    flags: {},
    detected,
    SCOPE_KIND: "new-feature",
    MODULE_KIND: "module-pair",
    MODULE_NAME: "module-demo",
    MODULE_DISPLAY: "Module Demo",
    MODULE_SLUG: "module-demo",
    SCAFFOLD: "both",
    SUBMODULES: "program/senarai-program,program/maklumat-program",
    USE_CASE: "A demo module.",
    ROUTE_PREFIX: "/module-demo",
    ROLE_KEY: "adminModuleDemo",
    REMOTE_PORT: "3002",
    BACKEND_PORT: "8081",
    API_BASES: "http://localhost:8081/api",
    UI_DEPENDENCY: "n/a",
    SHELL_REPO: "../shell",
    REPO_NAME: "module-demo",
    OWNER: "platform",
    DEPLOY_TARGET: "container",
    BLAST_RADIUS: "shell",
    INSTALL_DATE: "2026-01-31"
  });
}

/**
 * The three levels must mean three different things, and the differences must be
 * the *files*, not just the prose.
 *
 * A level that only changed the wording would be a lie with a prompt in front of
 * it: somebody picks Economy to get a smaller install, and gets the same one
 * plus an explanation of why it is small. So the assertions below are about
 * counts and about what a generated file claims — a `mvn verify` line promising
 * tests in a repository that has none is the exact failure this catches.
 */
async function checkScaffoldLevels(problems, log) {
  const context = syntheticContext();
  const plans = {};
  for (const level of ["economy", "recommended", "full"]) {
    try {
      plans[level] = skills.scaffold.plan(context, { level });
    } catch (err) {
      problems.push(`scaffold plan at ${level} threw: ${err.message}`);
      return;
    }
  }

  const counts = Object.fromEntries(Object.entries(plans).map(([level, plan]) => [level, plan.files.length]));
  if (!(counts.economy < counts.recommended && counts.recommended < counts.full)) {
    problems.push(`the levels do not change the size of the scaffold: ${JSON.stringify(counts)}`);
  }

  for (const [level, plan] of Object.entries(plans)) {
    if (plan.level !== level) problems.push(`plan at ${level} reports level ${plan.level}`);
    if (plan.unresolvedPaths.length) {
      problems.push(`scaffold paths at ${level} did not resolve: ${plan.unresolvedPaths.join(", ")}`);
    }
    if (plan.unresolvedTokens.length) {
      problems.push(
        `scaffold tokens at ${level} did not resolve: ${plan.unresolvedTokens.map((t) => `{{${t}}}`).join(", ")}`
      );
    }
    const leftovers = new Set();
    for (const file of plan.files) {
      for (const token of skills.reportableTokens(skills.collectTokens(file.content))) leftovers.add(token);
    }
    if (leftovers.size) {
      problems.push(
        `scaffold files at ${level} still contain placeholders: ${[...leftovers].map((t) => `{{${t}}}`).join(", ")}`
      );
    }
    for (const file of plan.files) {
      if (/__[A-Z_]+__/.test(file.content)) {
        problems.push(`scaffold file at ${level} still contains an unsubstituted directive: ${file.relative}`);
        break;
      }
    }
  }

  const names = (level) => plans[level].files.map((file) => file.relative);
  const economy = new Set(names("economy"));
  const full = new Set(names("full"));

  const dropped = [
    `${context.BACKEND_REPO}/src/test/java/com/dreams/module_demo/ModuleDemoApplicationTests.java`,
    `${context.BACKEND_REPO}/.editorconfig`
  ];
  for (const relative of dropped) {
    if (economy.has(relative)) problems.push(`economy still writes ${relative}`);
    if (!full.has(relative)) problems.push(`full is missing ${relative}`);
  }

  const added = [
    `${context.FRONTEND_REPO}/CHANGELOG.md`,
    `${context.BACKEND_REPO}/CHANGELOG.md`,
    `${context.FRONTEND_REPO}/.github/workflows/verify.yml`,
    `${context.BACKEND_REPO}/.github/workflows/verify.yml`
  ];
  for (const relative of added) {
    if (economy.has(relative)) problems.push(`economy writes ${relative}, which is a Full-level extra`);
    if (!full.has(relative)) problems.push(`full is missing ${relative}`);
  }

  // The build must be true of itself. Economy has no tests, so it may not carry
  // a test dependency, a test include, or a sentence about tests.
  const pom = (level) => plans[level].files.find((file) => file.relative.endsWith("/pom.xml")).content;
  const readme = (level) => plans[level].files.find((file) => file.relative.endsWith("_be/README.md")).content;

  const economyPom = pom("economy");
  for (const fragment of ["spring-boot-starter-test", "src/test/java", "includeTestSourceDirectory", "testSourceDirectory"]) {
    if (economyPom.includes(fragment)) {
      problems.push(`the economy pom still references tests (${fragment}) after dropping them`);
    }
  }
  for (const level of ["recommended", "full"]) {
    for (const fragment of ["spring-boot-starter-test", "src/test/java", "includeTestSourceDirectory"]) {
      if (!pom(level).includes(fragment)) {
        problems.push(`the ${level} pom lost ${fragment}, so mvn verify no longer runs tests`);
      }
    }
  }
  if (!economyReadmeMentions(readme("economy"), "tests")) {
    problems.push("the economy README still promises tests in `mvn verify`");
  }
  if (!fullReadmeMentions(readme("full"), "tests")) {
    problems.push("the full README does not mention tests in `mvn verify`");
  }
  for (const level of ["economy", "recommended"]) {
    if (readme(level).includes("Scaffold level | `Full`")) {
      problems.push(`the ${level} README contains the Full-only inventory table`);
    }
  }
  if (!readme("full").includes("## Inventory")) {
    problems.push("the full README has no inventory section");
  }

  log(
    "✓",
    `levels change the scaffold: ${counts.economy} / ${counts.recommended} / ${counts.full} files, ` +
      "and each build describes itself accurately"
  );
}

function economyReadmeMentions(text, word) {
  return !new RegExp(`\\b${word}\\b`).test(text.split("## Inventory")[0].split("mvn verify")[1] || "");
}

function fullReadmeMentions(text, word) {
  return new RegExp(`\\b${word}\\b`).test(text.split("## Inventory")[0].split("mvn verify")[1] || "");
}

/**
 * A gate is only worth having if it says three things and returns one of them.
 *
 * These checks are about the *mechanics* — the digits, the recording of who
 * chose, the refusal to be quiet in a non-interactive run without saying so —
 * because those are the parts that fail silently. The wording of a gate is read
 * by people and cannot be asserted, only kept honest by having it say what the
 * step is about to do.
 */
async function checkReviewGates(problems, log) {
  const levels = skills.LEVELS;
  if (levels.length !== 3) problems.push(`expected 3 review levels, found ${levels.length}`);
  if (levels.map((level) => level.digit).join(",") !== "1,2,3") {
    problems.push(`review levels must be numbered 1, 2, 3 in that order, got ${levels.map((l) => l.digit).join(", ")}`);
  }
  if (levels.map((level) => level.id).join(",") !== "recommended,economy,full") {
    problems.push(`review levels are not recommended/economy/full in order: ${levels.map((l) => l.id).join(", ")}`);
  }

  for (const [input, expected] of [
    ["1", "recommended"],
    ["2", "economy"],
    ["3", "full"],
    ["full", "full"],
    ["FULL", "full"],
    ["  economy  ", "economy"],
    [undefined, null],
    ["", null],
    ["nonsense", null]
  ]) {
    const got = skills.levelFor(input);
    if (got !== expected) problems.push(`levelFor(${JSON.stringify(input)}) is ${got}, expected ${expected}`);
  }

  const steps = skills.REVIEW_STEPS;
  const ids = steps.map((step) => step.id);
  if (ids.length !== 8) problems.push(`expected a gate for all 8 install stages, found ${ids.length}: ${ids.join(", ")}`);
  if (new Set(ids).size !== ids.length) problems.push("two review gates share an id");

  // Every stage the installer announces must have a gate, and every gate must
  // announce a stage. A stage that skipped the question is the failure this
  // catches, and it is only visible by reading the two lists against each other.
  const installer = fs.readFileSync(path.join(__dirname, "install.js"), "utf8");
  const announced = [...installer.matchAll(/heading\((["'`])\s*(\d+)\.\s*([A-Za-z][A-Za-z]*)/g)].map((m) => ({
    number: m[2],
    title: m[3]
  }));
  const gated = [...installer.matchAll(/id:\s*"([a-z]+)",\s*\n\s*title:\s*"(\d+)\.\s*([A-Za-z]+)/g)].map((m) => ({
    id: m[1],
    number: m[2],
    title: m[3]
  }));
  if (announced.length !== ids.length) {
    problems.push(`${announced.length} install stage(s) announced but ${ids.length} review gate(s) declared`);
  }
  for (const stage of announced) {
    const gate = gated.find((entry) => entry.number === stage.number);
    if (!gate) {
      problems.push(`install stage "${stage.number}. ${stage.title}" has no review gate`);
      continue;
    }
    if (gate.title !== stage.title) {
      problems.push(`the gate for stage ${stage.number} is titled "${gate.title}", the stage is "${stage.title}"`);
    }
  }
  for (const step of steps) {
    const stage = announced.find((entry) => entry.number === step.title.split(".")[0]);
    if (!stage) problems.push(`review gate "${step.id}" titles a stage the installer never announces`);
  }

  const collected = [];
  const out = { log: (line) => collected.push(line) };

  // A non-interactive run must be loud about which level it used, and must say
  // it was a default rather than a choice.
  const quietReview = skills.review.createReview({ flags: {}, interactive: false, out });
  const assumed = await quietReview.gate({
    id: "scaffold",
    title: "5. Scaffold",
    writes: ["write 41 files"],
    effects: { economy: "fewer", recommended: "the same", full: "more" }
  });
  if (assumed !== "recommended") problems.push(`a non-interactive gate chose ${assumed}, expected recommended`);
  if (!collected.join("\n").includes("nobody could be asked")) {
    problems.push("a non-interactive gate did not say it had nobody to ask");
  }
  if (quietReview.summary().steps.scaffold.source !== "assumed") {
    problems.push("a non-interactive gate did not record its choice as assumed");
  }

  // A typed answer, including the digit, must win over everything else.
  const answered = [];
  const asked = skills.review.createReview({
    flags: {},
    interactive: true,
    out: { log: (line) => answered.push(line) },
    prompter: { askLine: () => Promise.resolve("2") }
  });
  const chosen = await asked.gate({
    id: "readme",
    title: "6. README",
    writes: ["write a table"],
    effects: { economy: "none", recommended: "one", full: "three" }
  });
  if (chosen !== "economy") problems.push(`answering 2 chose ${chosen}, expected economy`);
  if (asked.summary().steps.readme.source !== "asked") {
    problems.push("an answered gate did not record its choice as asked");
  }
  const transcript = answered.join("\n");
  for (const fragment of ["write a table", "Economy", "Recommended", "Full"]) {
    if (!transcript.includes(fragment)) problems.push(`the gate transcript is missing "${fragment}"`);
  }

  // An explicit level answers every gate, says so, and never asks.
  let askedCount = 0;
  const pinned = skills.review.createReview({
    flags: { level: "full" },
    interactive: true,
    out,
    prompter: {
      askLine: () => {
        askedCount += 1;
        return Promise.resolve(null);
      }
    }
  });
  for (const step of steps) {
    const level = await pinned.gate({
      id: step.id,
      title: step.title,
      writes: ["write something"],
      effects: { economy: "less", recommended: "the same", full: "more" }
    });
    if (level !== "full") problems.push(`--level=full produced ${level} at ${step.id}`);
  }
  if (askedCount) problems.push(`--level=full still asked ${askedCount} time(s)`);

  // A terminal that closes mid-question is not a person who chose. The gate has
  // to say the level was assumed, and the record has to say `assumed` — otherwise
  // `.docs/install.json` claims a sign-off nobody gave.
  const closed = [];
  const abandoned = skills.review.createReview({
    flags: {},
    interactive: true,
    out: { log: (line) => closed.push(line) },
    prompter: { askLine: () => Promise.resolve(null) }
  });
  await abandoned.gate({
    id: "plan",
    title: "3. Plan",
    writes: ["write nothing"],
    effects: { economy: "less", recommended: "the same", full: "more" }
  });
  if (abandoned.summary().steps.plan.source !== "assumed") {
    problems.push("a gate nobody answered was recorded as a choice");
  }
  if (!closed.join("\n").includes("nothing was answered")) {
    problems.push("a gate nobody answered did not say so");
  }

  // A step with nothing to do must say so rather than offer a choice.
  const notApplicable = [];
  const inapplicable = skills.review.createReview({
    flags: {},
    interactive: true,
    out: { log: (line) => notApplicable.push(line) },
    prompter: { askLine: () => Promise.resolve("3") }
  });
  const level = await inapplicable.gate({
    id: "minio",
    title: "7. MinIO",
    applicable: false,
    skipReason: "no backend in this install",
    effects: {}
  });
  if (level !== "recommended") problems.push(`an inapplicable gate returned ${level}`);
  if (!notApplicable.join("\n").includes("no backend in this install")) {
    problems.push("an inapplicable gate did not say why it was skipped");
  }

  // A mistyped step id is a bug in the installer, not a skipped review.
  let threw = false;
  try {
    await skills.review.createReview({ flags: {}, interactive: false, out }).gate({ id: "nope", effects: {} });
  } catch (err) {
    threw = true;
  }
  if (!threw) problems.push("a gate for an unknown step did not fail");

  // The unit checks above hand the review a prompter directly. The installer has
  // to do the same, and nothing else in the suite can tell: without it every
  // gate falls back to "nobody could be asked" and an interactive run silently
  // installs at Recommended with the question never printed.
  const source = fs.readFileSync(path.join(__dirname, "install.js"), "utf8");
  const created = source.match(/createReview\(\{([^}]*)\}\)/s);
  if (!created || !/prompter/.test(created[1])) {
    problems.push("bin/install.js creates the review without a prompter, so no gate can ever ask");
  }

  // The bug this guards against is not hypothetical: on a terminal that does not
  // hand the child process a stdin TTY, `process.stdin.isTTY` alone was false, so
  // all eight gates fell back to Recommended, the intake was skipped, and the run
  // wrote 34 documents with 73 open placeholders and no source — while exiting 0
  // and blaming a `--parts=docs` flag nobody had passed.
  //
  // Two things have to hold. The decision may not rest on the stdin flag alone, and
  // it has to reach the person when it decides not to ask.
  if (!/resolveInteractivity/.test(source)) {
    problems.push("bin/install.js decides interactivity without resolveInteractivity, so it is back to trusting one flag");
  } else {
    const body = (source.match(/function resolveInteractivity[\s\S]*?\n\}/) || [""])[0];
    for (const [needle, why] of [
      ["flags.yes", "it does not recognise --yes as a deliberate non-interactive run"],
      ['process.env.CI', "it does not recognise a CI environment, where waiting for a keypress would hang the build"],
      // The precise condition, not the word "stdout": naming stdout somewhere in
      // the function while still testing stdin alone is exactly the regression.
      ["if (stdin || stdout)", "it tests only stdin, so a wrapper that drops that one flag still silences every gate"],
      // Likewise the word "warn" appears on the deliberate paths as `warn: null`.
      // The thing that must exist is an actual message on the involuntary one.
      ["cannot ask you anything", "it decides not to ask without saying so, so the fallback stays silent"]
    ]) {
      if (!body.includes(needle)) problems.push(`resolveInteractivity ${why}`);
    }
  }

  // The prompter used to re-test `isTTY` on top of the caller's decision, which
  // undid the fix above: the caller said "ask", the prompter refused, and the
  // result was the same silence with an extra step in between.
  const promptSource = fs.readFileSync(
    path.join(__dirname, "..", "lib", "prompt.js"),
    "utf8"
  );
  const isInteractive = promptSource.match(/function isInteractive\(\)\s*\{[^}]*\}/);
  if (!isInteractive) {
    problems.push("lib/prompt.js has no isInteractive to inspect");
  } else if (/isTTY/.test(isInteractive[0])) {
    problems.push(
      "lib/prompt.js's isInteractive re-tests isTTY, so it overrides the caller's decision and silences every gate"
    );
  }

  // "the person asked for documents only" and "the identity was never established"
  // both arrive as a missing SCAFFOLD. Reporting them the same way is how a run
  // skips the scaffold step claiming a --parts=docs flag nobody typed.
  const skip = (source.match(/skipReason:[\s\S]{0,400}/) || [""])[0];
  if (skip.includes("`--parts=docs") && !skip.includes("identityMissing")) {
    problems.push(
      "bin/install.js still attributes every documents-only run to --parts=docs, even when the identity was never established"
    );
  }
  if (!/identityMissing\s*\n\s*\?/.test(source) && !/identityMissing\s*\?/.test(source)) {
    problems.push(
      "bin/install.js computes whether the identity was missing but never uses it in the skip reason"
    );
  }

  log("✓", `review gates: 3 levels, ${steps.length} steps, asked / assumed / pinned all recorded`);
}

/**
 * The JavaScript out of a scaffolded frontend file.
 *
 * A `.vue` file is three languages in a trench coat, and two of them — the
 * template's HTML and the style block's CSS — are full of `property: value` lines
 * that a naive scan reads as object literals. `padding: 24px;` is not an object
 * property that needs a trailing comma, so checking a `.vue` file as if it were
 * JavaScript produces failures that are not there. The `.vue` files that ship in
 * `fe/src` all use `<script setup>`, so the script blocks are what get read.
 */
function jsOnly(body, rel) {
  const code = rel.endsWith(".vue")
    ? [...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n")
    : body;
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * The `key: value` lines that are the final entry of an object literal and carry
 * no trailing comma.
 *
 * Deliberately narrow. It only looks at a property whose value starts on its own
 * line and whose next line closes the literal, because that is the shape prettier
 * rewrites and the shape the broken templates had. A line that ends in `{` is
 * skipped: prettier leaves the opening brace of a last-but-one nested object alone,
 * and flagging it would be a false positive on a file that already passes.
 */
function lastPropertiesWithoutComma(code) {
  const lines = code.split("\n");
  const misses = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const next = lines[i + 1].trim();
    if (!/^[A-Za-z_$][\w$]*:\s+\S/.test(line)) continue;
    if (!/^[}\]]/.test(next)) continue;
    if (line.endsWith(",") || line.endsWith("{") || line.endsWith(";")) continue;
    misses.push(`${line.slice(0, 40)}`);
  }
  return misses;
}

/**
 * The body of an XML file with its comments removed.
 *
 * Both config files that matter here explain their own contents in a long comment
 * — which is the only reason a reader can tell whether an exclusion is still
 * justified. Testing the raw text therefore proves nothing: `EI_EXPOSE_REP2` is
 * named in the comment that explains the exclusion, so a check reading the file
 * as-is passes even when the exclusion itself has been deleted. Only the markup
 * is configuration; the prose is documentation.
 */
function withoutXmlComments(body) {
  return body.replace(/<!--[\s\S]*?-->/g, "");
}

/** The code out of a Java file: javadoc, block comments and line comments gone. */
function withoutJavaComments(body) {
  return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * JSON out of a scaffold *template*, which is not itself valid JSON.
 *
 * `fe/package.json` carries `__UI_DEP__` where the installer will splice in the
 * shared-UI dependency. A bare `__UI_DEP__` is not a JSON value, so reading the
 * template with `JSON.parse` throws and takes the whole self-test down with it —
 * which is exactly what happened the first time this was written.
 *
 * The stub needs to be a key and a value, because these directives stand where an
 * *entry* goes — inside an object, not inside an array. A bare `null` there is
 * parsed as a property name and rejected. It also needs a trailing comma, because
 * the snippets the installer splices in supply their own (`uiDependencySnippet`
 * ends in `,` or renders nothing at all). A directive that is the last thing in
 * its object is the one case where that comma would be a trailing comma, which
 * `JSON.parse` also rejects.
 *
 * `{{TOKEN}}` placeholders are quoted inside the template and parse as ordinary
 * strings, so they need no special handling.
 */
function parseTemplateJson(body, rel) {
  const stubbed = body.replace(
    /^[ \t]*__[A-Z_]+__[ \t]*$\n(?![ \t]*[}\]])/gm,
    '    "__scaffold_directive__": null,\n'
  );
  try {
    return JSON.parse(stubbed);
  } catch (err) {
    throw new Error(`${rel} is not parseable as JSON even with its directives stubbed: ${err.message}`);
  }
}

/**
 * The scaffolded repositories have to pass the gates their own READMEs tell the
 * reader to run. This is the check that was missing: 0.1.0 shipped a package whose
 * generated backend could not run `mvn verify` and whose generated frontend could
 * not run `npm run verify`, and nothing in the suite noticed, because every
 * existing check read the templates and never built from them.
 *
 * Both failures were the same class of mistake — a config that says one thing and a
 * formatter that demands another:
 *
 *   - `<springJavaFormat/>` is not a Spotless step any more, so the plugin failed
 *     while parsing its own configuration.
 *   - the checkstyle config had no DOCTYPE, so it failed before reading a rule.
 *   - `io.minio.Method` does not exist; the class is `io.minio.http.Method`.
 *   - the SpotBugs filter was empty while the code tripped `EI_EXPOSE_REP2`.
 *   - the frontend's `.prettierrc.json` asked for single quotes and es5 trailing
 *     commas while every generated file used double quotes and none.
 *
 * So the checks below assert the *agreement* rather than either side of it, and
 * each names the mismatch it exists to catch.
 *
 * Every assertion here was mutation-verified: break the thing, confirm the check
 * complains, put it back. Each of the three config files explains itself in a long
 * comment, and reading that prose as if it were configuration silently disarmed
 * three of these assertions before they were caught. `withoutXmlComments`,
 * `withoutJavaComments` and the `<java>`-block extraction exist because of that.
 */
function checkScaffoldGates(problems, log) {
  const root = path.join(__dirname, "..", "templates", "scaffold");
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

  const pom = read("be/pom.xml");

  // 1. The Spotless java block must name a step that exists in the plugin. The
  //    dead step is named in a comment explaining why it went, so the comment is
  //    stripped and only the configuration itself is inspected.
  const javaBlock = (pom.match(/<java>[\s\S]*?<\/java>/) || [""])[0].replace(/<!--[\s\S]*?-->/g, "");
  if (/<springJavaFormat[\s/>]/.test(javaBlock)) {
    problems.push("be/pom.xml configures springJavaFormat, which Spotless removed — mvn verify cannot parse it");
  }
  if (!/palantirJavaFormat|googleJavaFormat|eclipse|cleanthat/.test(javaBlock)) {
    problems.push(
      "be/pom.xml's Spotless <java> block names no supported formatter, so `mvn verify` will fail on any formatting question"
    );
  }
  for (const step of ["removeUnusedImports", "formatAnnotations"]) {
    if (!javaBlock.includes(step)) problems.push(`be/pom.xml's Spotless <java> block is missing <${step}>`);
  }

  // 2. Checkstyle cannot parse a config with no DOCTYPE. The error it produces
  //    ("Document root element \"module\", must match DOCTYPE root \"null\"")
  //    reads as a malformed file rather than a missing declaration.
  const checkstyle = withoutXmlComments(read("be/config/checkstyle/checkstyle.xml"));
  if (!/<!DOCTYPE module PUBLIC/.test(checkstyle)) {
    problems.push("be/config/checkstyle/checkstyle.xml has no DOCTYPE, so maven-checkstyle-plugin cannot parse it");
  }
  if (!/configuration_1_3\.dtd/.test(checkstyle)) {
    problems.push("the checkstyle DOCTYPE does not point at a versioned DTD");
  }

  // 3. The MinIO SDK moved Method into io.minio.http.
  const minio = withoutJavaComments(read("be/src/main/java/{{PKG_PATH}}/storage/MinioStorageService.java"));
  if (/^import io\.minio\.Method;$/m.test(minio)) {
    problems.push("MinioStorageService imports io.minio.Method, which does not exist — it is io.minio.http.Method");
  }
  if (!/^import io\.minio\.http\.Method;$/m.test(minio)) {
    problems.push("MinioStorageService does not import io.minio.http.Method");
  }

  // 4. The SpotBugs filter is referenced by the pom, so it has to exist and has to
  //    cover what the generated code actually trips. The comments are stripped
  //    first: the file explains the exclusion in prose, and the prose names the
  //    very finding the markup is supposed to be suppressing.
  const spotbugs = withoutXmlComments(read("be/config/spotbugs/exclude.xml"));
  if (!/<FindBugsFilter>/.test(spotbugs)) problems.push("be/config/spotbugs/exclude.xml is not a FindBugsFilter document");
  if (!/<Bug\s+pattern="EI_EXPOSE_REP2"/.test(spotbugs)) {
    problems.push(
      "the SpotBugs filter does not suppress EI_EXPOSE_REP2, which the generated constructors trip on every module"
    );
  }
  if (!/<excludeFilterFile>\s*config\/spotbugs\/exclude\.xml\s*<\/excludeFilterFile>/.test(pom)) {
    problems.push("be/pom.xml does not point SpotBugs at config/spotbugs/exclude.xml");
  }

  // 5. The app class name lives in the file name, not in the token: a template
  //    that renders {{MODULE_CLASS}} inside {{MODULE_CLASS}}Application.java
  //    produces a public class the compiler rejects.
  const appClass = read("be/src/main/java/{{PKG_PATH}}/{{MODULE_CLASS}}Application.java");
  if (!/public class \{\{MODULE_CLASS\}\}Application \{/.test(appClass)) {
    problems.push("the Spring Boot app template must declare {{MODULE_CLASS}}Application to match its file name");
  }
  const appTest = read("be/src/test/java/{{PKG_PATH}}/{{MODULE_CLASS}}ApplicationTests.java");
  if (!/class \{\{MODULE_CLASS\}\}ApplicationTests \{/.test(appTest)) {
    problems.push("the app test template must declare {{MODULE_CLASS}}ApplicationTests to match its file name");
  }

  // 6. The frontend config and the frontend files have to agree on quotes and
  //    trailing commas. Neither side is wrong on its own; disagreeing is what made
  //    `npm run verify` fail on a module the installer had just written.
  const prettierrc = JSON.parse(read("fe/.prettierrc.json"));
  const feSrc = [
    "fe/src/metadata.js",
    "fe/src/preview/main.js",
    "fe/src/preview/router.js",
    "fe/src/preview/pinia.js",
    "fe/src/preview/App.vue",
    "fe/src/services/{{MODULE_SNAKE}}/http.js",
    "fe/src/views/__SUB__.vue"
  ];
  for (const rel of feSrc) {
    const body = read(rel);
    const code = jsOnly(body, rel);
    const hasSingle = /(^|[^"'`\\])'[^'\n]*'/.test(code);
    const hasDouble = /(^|[^"'`\\])"[^"\n]*"/.test(code);
    if (prettierrc.singleQuote === false && hasSingle) {
      problems.push(`${rel} uses single quotes but .prettierrc.json sets singleQuote: false`);
    }
    if (prettierrc.singleQuote === true && hasDouble) {
      problems.push(`${rel} uses double quotes but .prettierrc.json sets singleQuote: true`);
    }
    if (prettierrc.endOfLine === "lf" && body.includes("\r")) {
      problems.push(`${rel} contains CRLF but .prettierrc.json sets endOfLine: lf`);
    }
    // `trailingComma: "all"` also puts a comma on the last property of an object
    // literal, which is the one the router snippet kept getting wrong.
    if (prettierrc.trailingComma === "all") {
      for (const miss of lastPropertiesWithoutComma(code)) {
        problems.push(
          `${rel} has "${miss}" as the last property of an object without a trailing comma, but .prettierrc.json sets trailingComma: all`
        );
      }
    }
  }
  if (prettierrc.endOfLine !== "lf") {
    problems.push("fe/.prettierrc.json must set endOfLine: lf so a Windows checkout cannot reintroduce the 0.1.0 failure");
  }

  // 7. The generated route table is built in JS, not from a template, so it has to
  //    be checked where it is actually produced.
  const routes = skills.scaffold.routesSnippet({
    MODULE_NAME: "m",
    MODULE_DISPLAY: "M",
    ROUTE_PREFIX: "/m",
    SUBMODULES: "program/p"
  });
  for (const [needle, why] of [
    ["component: () => import(", "routesSnippet omits the component property"],
    ["),\n  },", "routesSnippet leaves the last property or the closing brace without a trailing comma"],
    ['{ path: "/", redirect:', "routesSnippet omits the root redirect"]
  ]) {
    if (!routes.includes(needle)) problems.push(why);
  }

  // 8. Every env key a module owns has to be namespaced by module, or two remotes
  //    on one machine decide each other's remote base.
  const envExample = read("fe/.env.example");
  const vueConfig = read("fe/vue.config.js");
  if (/^VUE_APP_MODUL=/m.test(envExample)) {
    problems.push("fe/.env.example defines a bare VUE_APP_MODUL, which two modules on one machine will collide on");
  }
  if (!/VUE_APP_\{\{MODULE_PASCAL_UPPER\}\}=/.test(envExample)) {
    problems.push("fe/.env.example does not namespace this module's own origin key by module");
  }
  if (!/VUE_APP_\{\{MODULE_PASCAL_UPPER\}\}/.test(vueConfig)) {
    problems.push("fe/vue.config.js does not read this module's own namespaced origin key");
  }

  // 9. Line endings are part of the contract, not a matter of taste: 0.1.0 shipped
  //    97 CRLF files because the package was published from a Windows checkout.
  const attrs = path.join(__dirname, "..", ".gitattributes");
  if (!fs.existsSync(attrs)) {
    problems.push("there is no .gitattributes, so a Windows checkout republishes every file as CRLF");
  } else if (!/\* text=auto eol=lf/.test(fs.readFileSync(attrs, "utf8"))) {
    problems.push(".gitattributes does not pin text files to LF");
  }

  // 10. The licence was UNLICENSED in 0.1.0, which npm reads as "do not use this".
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  if (pkg.license === "UNLICENSED" || !pkg.license) {
    problems.push(`package.json license is ${JSON.stringify(pkg.license)}, which tells npm this is not for use`);
  }
  if (!pkg.repository || !pkg.repository.url) {
    problems.push("package.json has no repository url, so the npm page cannot link to the source");
  }
  if (!pkg.publishConfig || pkg.publishConfig.access !== "public") {
    problems.push("package.json does not declare publishConfig.access public");
  }
  if (!fs.existsSync(path.join(__dirname, "..", "LICENSE"))) {
    problems.push("package.json declares a licence but there is no LICENSE file");
  }

  // 11. The lint resolver's `conditions` and the version that honours it live in
  //     two different files, and nothing at build time connects them. The result
  //     is a silent one: delete the `overrides` block and every module goes back
  //     to reporting its own UI import as unresolved — a warning, so `verify`
  //     still exits 0, and a warning that trains people to ignore lint output.
  //
  //     Read with the comments stripped. These files explain themselves in prose
  //     that quotes the very setting being checked, and that has now defeated a
  //     text match three separate times: `springJavaFormat` in the pom, the
  //     `EI_EXPOSE_REP2` exclusion, and `conditions: ["import"]` here. A check
  //     that reads a config's own explanation proves nothing.
  const eslintrc = withoutJavaComments(read("fe/.eslintrc.cjs"));
  if (!/conditions:\s*\[[^\]]*"import"/.test(eslintrc)) {
    problems.push(
      "fe/.eslintrc.cjs does not ask the import resolver for the `import` condition, so a package whose exports map declares only `import` is reported unresolved"
    );
  }
  if (!/extensions:\s*\[[^\]]*"\.css"/.test(eslintrc)) {
    problems.push("fe/.eslintrc.cjs does not list .css in the resolver's extensions");
  }
  const fePkg = parseTemplateJson(read("fe/package.json"), "fe/package.json");
  const forced = fePkg.overrides && fePkg.overrides["eslint-import-resolver-node"];
  if (!forced || !/0\.4/.test(String(forced))) {
    problems.push(
      "fe/package.json does not override eslint-import-resolver-node to 0.4.x, the only version that reads the `conditions` set in .eslintrc.cjs"
    );
  }

  log("✓", "scaffold gates: pom, checkstyle DOCTYPE, minio import, spotbugs filter, quotes, resolver and line endings all agree");
}

/**
 * The intake's questions are the only place a person types anything. A tier that
 * does not change the list is a level that only changes the word "Full".
 */
function checkIntakeTiers(problems, log) {
  const existing = {
    isNew: false,
    kind: "remote-module",
    federation: { name: "v2t", exposes: [], remotes: [] },
    metadata: { remoteName: "v2t", routePrefix: "/v2t" },
    ui: { isGit: true, dependency: "git+https://example/ui.git#main" },
    env: { keys: ["VUE_APP_URL_KOD", "PORT"], sources: [{ file: ".env.example", keys: [] }] },
    package: { scripts: { serve: "vue-cli-service serve --port 3002" } }
  };
  const fresh = { isNew: true, kind: "new", federation: { name: "", exposes: [], remotes: [] }, metadata: {}, ui: {}, env: { keys: [], sources: [] }, package: {} };

  for (const [name, detected] of [["new", fresh], ["existing", existing]]) {
    const counts = {};
    for (const level of ["economy", "recommended", "full"]) {
      const flow = skills.buildFlow(detected, { level });
      counts[level] = flow.questions.length;
      if (!flow.questions.length) problems.push(`the ${level} ${name} flow has no questions at all`);
    }
    if (counts.full <= counts.recommended) {
      problems.push(`the ${name} intake does not grow at the full level: ${JSON.stringify(counts)}`);
    }
    if (counts.recommended !== counts.economy) {
      problems.push(`the ${name} intake changes at the economy level: ${JSON.stringify(counts)}`);
    }

    const full = skills.buildFlow(detected, { level: "full" }).questions.map((q) => q.key);
    const recommended = skills.buildFlow(detected, { level: "recommended" }).questions.map((q) => q.key);
    const extras = full.filter((key) => !recommended.includes(key));
    for (const key of extras) {
      const question = skills.questions.FULL_IDENTITY_QUESTIONS.concat(skills.questions.NEW_QUESTIONS).find(
        (entry) => entry.key === key
      );
      if (!question || question.tier !== "full") {
        problems.push(`question ${key} is only asked at the full level but is not marked as such`);
      }
    }
  }

  // The Full-only confirmations must be pre-filled from the repository, or they
  // are six prompts asking somebody to retype what the machine already read.
  const flow = skills.buildFlow(existing, { level: "full" });
  const context = { detected: existing, flow: "existing", level: "full" };
  for (const question of flow.questions) {
    if (question.tier !== "full") continue;
    const value = typeof question.default === "function" ? question.default(context) : question.default;
    if (value === undefined || value === null || value === "") {
      problems.push(`the full-only question ${question.key} has no detected default to offer`);
    }
  }

  log("✓", `intake tiers: recommended asks the base flow, full adds ${skills.questions.FULL_IDENTITY_QUESTIONS.length} confirmations`);
}

/** The scaffold must expand completely, or a fresh repository starts broken. */
function checkScaffoldTemplates(problems, log) {
  const fe = skills.collectScaffoldTemplates("fe");
  const be = skills.collectScaffoldTemplates("be");
  const missing = [];
  if (!Object.keys(fe).length) missing.push("templates/scaffold/fe");
  if (!Object.keys(be).length) missing.push("templates/scaffold/be");

  if (missing.length) {
    problems.push(`scaffold templates missing: ${missing.join(", ")}`);
    return;
  }

  // Two names never reach a published package: npm refuses to write `.gitignore`
  // into a tarball, and a `.env` beside the generated repository's own
  // `.gitignore` is ignored by it. Locally both files are simply on disk, so the
  // mistake survives every test that reads this directory — it surfaces on the
  // first install from `npx`, where the file is gone.
  const UNSHIPPABLE = [".gitignore", ".npmignore", ".npmrc", ".env"];
  const refused = Object.entries({ "fe/": fe, "be/": be }).flatMap(([prefix, entries]) =>
    Object.keys(entries)
      .filter((key) => UNSHIPPABLE.includes(key.split("/").pop()))
      .map((key) => prefix + key)
  );
  if (refused.length) {
    problems.push(
      `scaffold template(s) that will not be published: ${refused.join(", ")} — ` +
        `rename them and add the mapping to PATH_RENAMES in lib/scaffold.js`
    );
  }

  const context = syntheticContext();
  let plan;
  try {
    plan = skills.scaffold.plan(context);
  } catch (err) {
    problems.push(`scaffold plan threw: ${err.message}`);
    return;
  }

  if (!plan.files.length) {
    problems.push("scaffold plan produced no files");
    return;
  }
  if (plan.unresolvedPaths.length) {
    problems.push(`scaffold paths did not resolve: ${plan.unresolvedPaths.join(", ")}`);
  }
  if (plan.unresolvedTokens.length) {
    problems.push(`scaffold tokens did not resolve: ${plan.unresolvedTokens.map((t) => `{{${t}}}`).join(", ")}`);
  }

  const leftovers = new Set();
  for (const file of plan.files) {
    for (const token of skills.reportableTokens(skills.collectTokens(file.content))) leftovers.add(token);
  }
  if (leftovers.size) {
    problems.push(
      `scaffold files still contain placeholders: ${[...leftovers].map((t) => `{{${t}}}`).join(", ")}`
    );
  }

  const expected = {
    fe: plan.files.filter((f) => f.relative.startsWith(`${context.FRONTEND_REPO}/`)).length,
    be: plan.files.filter((f) => f.relative.startsWith(`${context.BACKEND_REPO}/`)).length
  };
  if (expected.fe < 10) problems.push(`frontend scaffold is only ${expected.fe} files`);
  if (expected.be < 20) problems.push(`backend scaffold is only ${expected.be} files`);

  // ...and the renamed templates must come out under the names a repository
  // needs, or the mapping has silently stopped applying.
  const produced = new Set(plan.files.map((f) => f.relative));
  const wantedNames = [
    `${context.FRONTEND_REPO}/.gitignore`,
    `${context.BACKEND_REPO}/.gitignore`,
    `${context.BACKEND_REPO}/.env`
  ];
  const absent = wantedNames.filter((relative) => !produced.has(relative));
  if (absent.length) {
    problems.push(`scaffold does not produce: ${absent.join(", ")}`);
  }

  log("✓", `scaffold expands cleanly at recommended: ${plan.files.length} files (${expected.fe} fe / ${expected.be} be)`);

  checkGeneratedEndpoints(plan, context, problems, log);
}

/**
 * The README's API table is generated by reading the Spring annotations. If the
 * annotations the scaffold writes cannot be read back by the reader that writes
 * the table, every freshly scaffolded README is wrong on its first run — and
 * wrong documentation nobody doubted is the expensive kind.
 */
function checkGeneratedEndpoints(plan, context, problems, log) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "dreams-scaffold-"));
  try {
    for (const file of plan.files) {
      const target = path.join(temp, file.relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content, "utf8");
    }

    const backend = path.join(temp, context.BACKEND_REPO);
    const rows = skills.readme.detectApis(backend);
    const wanted = [
      "POST /api/module-demo/documents",
      "GET /api/module-demo/documents/{key}",
      "DELETE /api/module-demo/documents/{key}"
    ];
    const found = rows.map((row) => `${row.method} ${row.endpoint}`);
    const absent = wanted.filter((endpoint) => !found.includes(endpoint));
    if (absent.length) {
      problems.push(
        `detectApis does not read back the scaffolded controller: missing ${absent.join(", ")} ` +
          `(it read ${found.length ? found.join(", ") : "nothing"})`
      );
    } else {
      log("✓", `detectApis reads the generated controller back (${rows.length} endpoint(s))`);
    }

    const frontend = path.join(temp, context.FRONTEND_REPO);
    const routes = skills.readme.detectRoutes(frontend);
    if (routes.length < 2) {
      problems.push(`detectRoutes found ${routes.length} route(s) in the scaffolded frontend`);
    } else {
      log("✓", `detectRoutes reads the generated exposes back (${routes.length} route(s))`);
    }
  } catch (err) {
    problems.push(`scaffold round-trip failed: ${err.message}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * The rows a table is rendered from, per block mode.
 *
 * Routes and API rows are read out of code; the workspace inventory has no code
 * to read, so it comes from the intake. A mode that falls through to the wrong
 * one here would put a route table where a repository inventory belongs.
 */
function rowsForBlock(mode, context) {
  if (mode === "api") return skills.readme.derivedApis(context);
  if (mode === "workspace") return skills.readme.derivedWorkspace(context);
  return skills.readme.derivedRoutes(context);
}

/** The marker blocks must pair inside the markdown they are written into. */
function checkReadmeRendering(problems, log) {
  const context = syntheticContext();
  for (const mode of Object.keys(skills.README_BLOCKS)) {
    const rows = rowsForBlock(mode, context);
    if (!rows.length) {
      problems.push(`derived ${mode} rows are empty`);
      continue;
    }
    const block = skills.readme.render(mode, rows);
    if (!skills.readme.blockRange(block, mode)) {
      problems.push(`${mode} rendering does not produce a paired marker block`);
    }
    if (!block.includes(context.MODULE_SLUG)) {
      problems.push(`${mode} rendering does not mention the module slug`);
    }
  }
  log("✓", `README marker blocks render paired and named (${Object.keys(skills.README_BLOCKS).length} modes)`);
}

/** Object storage help must name this module's bucket, or it is generic advice. */
function checkMinioSurface(problems, log) {
  const context = syntheticContext();
  const text = skills.minio.instructions(context.BUCKET, {});
  if (!text.includes(context.BUCKET)) {
    problems.push("minio.instructions does not mention the module bucket");
  }
  if (!/MC_HOST|mc mb/.test(text)) {
    problems.push("minio.instructions does not show how to create the bucket with minio/mc");
  }
  if (!text.includes(skills.minio.DEFAULT_ENDPOINT)) {
    problems.push("minio.instructions does not name the local endpoint");
  }
  log("✓", `MinIO instructions are module-specific (bucket ${context.BUCKET})`);
}

function report(problems, warnings, quiet) {
  if (quiet && !problems.length && !warnings.length) return;

  console.log("");
  if (problems.length) {
    console.log(`  ✗ ${problems.length} problem(s):`);
    for (const p of problems) console.log(`      • ${p}`);
  }
  if (warnings.length) {
    console.log(`  ! ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`      • ${w}`);
  }
  if (!problems.length && !warnings.length) console.log("  ✓ governance tree is healthy");
  console.log("");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  run({ quiet: args.includes("--quiet"), self: args.includes("--self") });
}

module.exports = { run, findRepositoryRoot };
