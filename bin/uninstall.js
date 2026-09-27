#!/usr/bin/env node

"use strict";

/**
 * dreams-ai-skills-uninstall — remove what this package wrote.
 *
 * Removal is narrow on purpose. A governance tree is edited by hand, and
 * `CHANGE-REQUEST/`, `AUDIT` and `ADR` entries are the only record of why a
 * decision was made. So:
 *
 *   - the `.docs` tree is only removed when it is empty of foreign content, or
 *     when `--purge` is given;
 *   - a hand-edited document is backed up to `.docs/.removed/` instead of
 *     deleted;
 *   - a root `AGENTS.md` is only removed when it carries this package's marker.
 *     A file the user wrote themselves is left completely alone.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const skills = require("../index.js");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Has this document been changed since the installer wrote it?
 *
 * The comparison is against the sha256 recorded in `.docs/install.json` at write
 * time, not against the template. Comparing against a template would report
 * every document as edited, because a rendered document differs from its
 * template by exactly the substitutions it was installed with.
 *
 * A document with no recorded hash — written by an older version, or kept rather
 * than overwritten by a later install — counts as edited. Preserving work is the
 * cheap mistake; deleting it is not recoverable if it was never committed.
 */
function isHandEdited(file, recordedHash) {
  if (!fs.existsSync(file)) return false;
  if (!recordedHash) return true;
  return sha256(fs.readFileSync(file, "utf8")) !== recordedHash;
}

/**
 * Files under `.docs` that this package did not write.
 *
 * The known set is expressed relative to `.docs` — the same root this walks
 * from — because a `CHANGE-REQUEST.md` is a legitimate hand-written document in
 * the same folder as our own output, and the only reliable way to tell them
 * apart is the full relative path.
 */
function listForeignFiles(docsRoot) {
  if (!fs.existsSync(docsRoot)) return [];
  const prefix = `${skills.GOVERNANCE_SUBDIR}/`;
  const known = new Set([
    ...skills.allGovernanceFiles().map((rel) => `${prefix}${rel}`),
    `${prefix}README.md`,
    "install.json"
  ]);
  const foreign = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".removed") continue;
      const rel = path.relative(docsRoot, path.join(dir, entry.name)).split(path.sep).join("/");
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (!known.has(rel)) foreign.push(rel);
    }
  };
  walk(docsRoot);
  return foreign;
}

function run({ quiet = false, purge = false } = {}) {
  const log = (icon, message) => {
    if (!quiet) console.log(`  ${icon} ${message}`);
  };

  const argv = process.argv.slice(2);
  const doPurge = purge || argv.includes("--purge");

  console.log(`\n  @lqmnwido/dreams-ai-skills — uninstall`);
  console.log("  ─────────────────────────────────────────────────────────────\n");

  const cwd = process.cwd();
  const docsRoot = path.join(cwd, skills.DOCS_DIR);
  const governanceRoot = path.join(cwd, skills.GOVERNANCE_DIR);
  const agentsPath = path.join(cwd, skills.AGENTS_FILENAME);
  const templates = skills.collectGovernanceTemplates();
  const removed = [];
  const backedUp = [];

  /* 1. Governance documents ------------------------------------------ */

  if (fs.existsSync(governanceRoot)) {
    const backupDir = path.join(docsRoot, ".removed");
    const statePath = path.join(docsRoot, "install.json");
    let hashes = {};
    if (fs.existsSync(statePath)) {
      try {
        hashes = JSON.parse(fs.readFileSync(statePath, "utf8")).hashes || {};
      } catch (err) {
        console.log(`  ! .docs/install.json is not valid JSON (${err.message}) — every document is treated as hand-edited`);
      }
    } else {
      console.log("  ! no .docs/install.json — every document is treated as hand-edited");
    }

    for (const rel of Object.keys(templates)) {
      const file = path.join(governanceRoot, rel);
      if (!fs.existsSync(file)) continue;

      if (isHandEdited(file, hashes[rel]) && !doPurge) {
        fs.mkdirSync(backupDir, { recursive: true });
        const target = path.join(backupDir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(file, target);
        fs.rmSync(file);
        backedUp.push(rel);
        log("→", `edited document preserved → ${path.relative(cwd, target)}`);
      } else {
        fs.rmSync(file);
        removed.push(rel);
        log("✓", `removed ${path.relative(cwd, file)}`);
      }
    }

    /* 2. State file ------------------------------------------------- */

    if (fs.existsSync(statePath)) {
      fs.rmSync(statePath);
      log("✓", `removed ${path.relative(cwd, statePath)}`);
    }

    /* 3. Empty-tree cleanup ------------------------------------------ */

    // `.removed` holds hand-edited documents from an earlier run. It is the only
    // place that work survives, so it is never deleted implicitly.
    const kept = path.join(docsRoot, ".removed");
    const hasKept = fs.existsSync(kept) && fs.readdirSync(kept).length > 0;
    const foreign = listForeignFiles(docsRoot);

    if (foreign.length && !doPurge) {
      log("!", `${foreign.length} file(s) in .docs are not managed by this package — left in place:`);
      for (const f of foreign.slice(0, 10)) log(" ", `- ${f}`);
      log("!", "pass --purge to remove them too");
    } else if (hasKept && !doPurge) {
      log("→", `kept ${path.relative(cwd, kept)} — it holds hand-edited documents removed earlier`);
      log(" ", "move it out of the repository before running --purge");
    } else if (fs.existsSync(docsRoot)) {
      fs.rmSync(docsRoot, { recursive: true, force: true });
      log("✓", `removed ${path.relative(cwd, docsRoot)}`);
    }
  } else {
    log("–", `no ${skills.GOVERNANCE_DIR} directory found`);
  }

  /* 4. AGENTS.md ---------------------------------------------------- */

  if (fs.existsSync(agentsPath)) {
    const content = fs.readFileSync(agentsPath, "utf8");
    if (content.includes(skills.MARKER)) {
      const backup = `${agentsPath}.bak`;
      fs.copyFileSync(agentsPath, backup);
      fs.rmSync(agentsPath);
      log("✓", `removed ${skills.AGENTS_FILENAME} (backup at ${path.basename(backup)})`);
    } else {
      log("→", `kept ${skills.AGENTS_FILENAME} — no "${skills.MARKER}" marker, so it is not ours`);
    }
  } else {
    log("–", `no ${skills.AGENTS_FILENAME} found`);
  }

  console.log(
    `\n  ${removed.length} generated file(s) removed, ${backedUp.length} hand-edited file(s) preserved.\n`
  );
}

if (require.main === module) {
  run({ quiet: process.argv.slice(2).includes("--quiet") });
}

module.exports = { run };
