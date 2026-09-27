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
 *   - a generated README table is removed and the README around it is kept;
 *   - a scaffolded file is removed only while its sha256 still matches what
 *     the scaffold wrote. Anything a developer has since implemented stays.
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

  const statePath = path.join(docsRoot, "install.json");
  let state = null;
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch (err) {
      console.log(`  ! .docs/install.json is not valid JSON (${err.message}) — every document is treated as hand-edited`);
    }
  } else {
    console.log("  ! no .docs/install.json — every document is treated as hand-edited");
  }

  /* 1. Governance documents ------------------------------------------ */

  if (fs.existsSync(governanceRoot)) {
    const backupDir = path.join(docsRoot, ".removed");
    const hashes = (state && state.hashes) || {};

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

    // Nine empty section folders left behind make a repository look half-
    // uninstalled, and nothing else ever comes back to clear them. `.removed`
    // sits outside the governance tree, so the work it holds is untouched.
    if (pruneEmpty(governanceRoot)) {
      fs.rmdirSync(governanceRoot);
      log("✓", `removed empty ${skills.GOVERNANCE_DIR}`);
    }

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

  /* 5. Scaffolded repositories --------------------------------------- */

  const scaffoldRemoved = removeScaffold({ cwd, state, log, doPurge });

  /* 6. Generated README tables --------------------------------------- */

  const readmeRemoved = removeReadmeBlocks({ cwd, state, log });

  console.log(
    `\n  ${removed.length} generated file(s) removed, ${backedUp.length} hand-edited file(s) preserved, ` +
      `${readmeRemoved} README table(s) cleared, ${scaffoldRemoved.kept} scaffolded file(s) kept as edited.\n`
  );
}

/**
 * The generated table goes; the README around it stays.
 *
 * This runs *after* the scaffold pass on purpose: a scaffolded README that is
 * still byte-identical to what we wrote has already been deleted there, and
 * one a developer has kept has lost nothing but our table. `--purge` does not
 * change this — the table is ours and the prose is not.
 */
function removeReadmeBlocks({ cwd, state, log }) {
  const entries = Object.entries((state && state.readme) || {}).filter(
    ([, entry]) => entry && entry.action && entry.action !== "dry"
  );
  if (!entries.length) {
    log("–", "no generated README tables recorded");
    return 0;
  }

  let cleared = 0;
  for (const [mode, entry] of entries) {
    const dir = entry.path ? path.resolve(cwd, path.dirname(entry.path)) : cwd;
    if (!skills.readme.hasBlock(dir, mode)) {
      // The usual reason is that the scaffold pass already deleted the file it
      // lived in, because it had not been touched since we wrote it. Saying
      // "already absent" there would read as a table somebody else removed.
      const file = path.join(dir, skills.readme.README_NAME);
      log(
        "–",
        !fs.existsSync(file) && entry.path
          ? `${entry.path} removed with the scaffolded repository`
          : `${mode} table already absent`
      );
      continue;
    }
    const outcome = skills.readme.removeBlock(dir, mode, { created: Boolean(entry.created) });
    if (outcome.action === "removed-file") {
      log("✓", `removed ${entry.path} — this package created it`);
    } else if (outcome.action === "removed-block") {
      log("✓", `removed the ${mode} table from ${entry.path}`);
    } else {
      continue;
    }
    cleared += 1;
  }
  return cleared;
}

/**
 * Scaffolded source is deleted only while it is byte-for-byte what we wrote.
 *
 * The sha256 recorded at install time is the only honest test: a scaffolded
 * file that a developer has since implemented is their work, and a backup of it
 * somewhere is not the same as it still being in the tree. So edited files stay
 * where they are and are reported, and directories are pruned only once they
 * are genuinely empty.
 */
function removeScaffold({ cwd, state, log, doPurge }) {
  const hashes = (state && state.scaffold && state.scaffold.hashes) || {};
  const names = Object.keys(hashes);
  const kept = [];

  if (!names.length) {
    log("–", "no scaffolded files recorded");
    return { kept: 0 };
  }

  for (const rel of names) {
    const file = path.join(cwd, rel);
    if (!fs.existsSync(file)) continue;

    const matches = sha256(fs.readFileSync(file, "utf8")) === hashes[rel];
    if (matches || doPurge) {
      fs.rmSync(file);
      log("✓", `removed ${rel}${matches ? "" : " (changed since the scaffold — --purge)"}`);
    } else {
      kept.push(rel);
      log("→", `kept ${rel} — edited since the scaffold wrote it`);
    }
  }

  for (const repository of (state && state.scaffold && state.scaffold.repositories) || []) {
    const dir = path.join(cwd, repository);
    if (!fs.existsSync(dir)) continue;
    if (pruneEmpty(dir)) {
      fs.rmdirSync(dir);
      log("✓", `removed empty directory ${repository}/`);
    }
  }

  return { kept: kept.length };
}

/** Depth-first: remove directories that have nothing left in them. */
function pruneEmpty(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return false;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && pruneEmpty(full)) fs.rmdirSync(full);
  }

  try {
    return fs.readdirSync(dir).length === 0;
  } catch (err) {
    return false;
  }
}

if (require.main === module) {
  run({ quiet: process.argv.slice(2).includes("--quiet") });
}

module.exports = { run };
