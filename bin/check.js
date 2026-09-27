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
function run({ quiet = false, self = false } = {}) {
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
      warnings.push(
        `the repository classified as "${detection.kind}" now, but the install recorded "${state.detection.kind}" — re-run the installer if the repository's role changed`
      );
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

  report(problems, warnings, quiet);
  process.exitCode = problems.length ? 1 : 0;
}

/** `--self` validates the package itself, so `npm test` is meaningful. */
function selfCheck(log) {
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

  const sample = skills.render("{{MODULE_NAME}} / {{ROUTE_PREFIX}}", { MODULE_NAME: "v2t", ROUTE_PREFIX: "/v2t" });
  if (sample.text !== "v2t / /v2t") problems.push("renderer does not substitute correctly");
  const missingTok = skills.render("{{NOPE}}", {});
  if (missingTok.text !== "{{NOPE}}" || !missingTok.unresolved.includes("NOPE")) {
    problems.push("renderer does not preserve unresolved tokens");
  }
  log("✓", "renderer substitutes and preserves correctly");

  report(problems, [], false);
  process.exitCode = problems.length ? 1 : 0;
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
