#!/usr/bin/env node

"use strict";

/**
 * dreams-ai-skills — install governance skills into one repository.
 *
 *   npx -y @lqmnwido/dreams-ai-skills
 *
 * The installer never writes outside the current working directory, never
 * modifies source, and never installs a package. It writes two things:
 *
 *   AGENTS.md                    the router every AI agent reads first
 *   .docs/project-governance/**  the governance tree
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

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

const BOOLEAN_FLAGS = new Set(["force", "yes", "dry-run", "check", "uninstall", "quiet", "help", "self"]);
const VALUE_FLAGS = new Set([
  "scope",
  "kind",
  "module",
  "display",
  "submodule",
  "usecase",
  "role",
  "port",
  "route-prefix",
  "apis",
  "shell",
  "ui-dep",
  "name",
  "owner",
  "deploy",
  "blast-radius",
  "confirm-identity"
]);

const HELP = `
  @lqmnwido/dreams-ai-skills v${skills.VERSION}
  Per-repository governance skills for the D-ReAMS micro-frontend platform.

  Usage
    npx -y @lqmnwido/dreams-ai-skills [options]

  What it writes
    AGENTS.md                    the router every AI agent reads first
    .docs/project-governance/**  the governance tree (30 documents)

  Intake (every question has a matching flag, so the whole flow is scriptable)
    --scope=<id>              new-feature | change-request | debug
    --kind=<id>               shell | remote-module | shared-ui | backend-api
    --module=<name>           federation remote name, e.g. v2t
    --display=<label>         display name, e.g. V2T
    --submodule=<a,b>         sub-module names, e.g. program/senarai-program
    --usecase=<text>          one-line use case (repeatable)
    --route-prefix=/v2t       Shell route prefix
    --role=<roleId>           role id granting access, e.g. adminv2t
    --port=<port|n/a>         local development port
    --apis=<A,B>              backend API base env vars
    --shell=<path>            path or URL of the Shell repository
    --ui-dep=<value>          @2enapps/ui dependency, or n/a
    --name=<repoName>         repository name
    --owner=<name>            owning team or engineer
    --deploy=<id>             static | container | library | unknown

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

  for (const key of prompter.missing) {
    log("!", `${key} is unresolved — it will be written as {{${key}}}`, quiet);
  }

  return { context: skills.buildContext(report, context), flow: flow.flow, asked: prompter.asked };
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
    heading("4. Result");
    log("→", `flow: ${flow}`);
    log("→", `module: ${context.MODULE_NAME} (${context.MODULE_DISPLAY}) · ${context.SCOPE_KIND}`);
    log("→", `files: ${total} written, ${kept} kept`);

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
  console.log("    3. Open AGENTS.md — every AI agent reads it before touching this repository.\n");
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

  const written = {};
  const hashes = {};
  const agentsPath = path.join(report.cwd, skills.AGENTS_FILENAME);
  written.agents = writeFileSafe(
    agentsPath,
    result.agents.text,
    { force: Boolean(flags.force), dryRun, quiet }
  );
  if (written.agents === "written") hashes[skills.AGENTS_FILENAME] = sha256(result.agents.text);

  const docsRoot = path.join(report.cwd, skills.GOVERNANCE_DIR);
  for (const [relative, content] of Object.entries(result.governance.files)) {
    const target = path.join(docsRoot, relative);
    written[relative] = writeFileSafe(target, content, {
      force: Boolean(flags.force),
      dryRun,
      quiet
    });
    // The hash is of the content this run *produced*, which is what makes "was
    // this document edited afterwards?" answerable at uninstall time. A file
    // this run refused to overwrite gets no new hash, so an edited one is still
    // recognised as edited later.
    if (written[relative] === "written") hashes[relative] = sha256(content);
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
          hashes
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
