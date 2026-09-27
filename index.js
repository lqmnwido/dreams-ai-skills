"use strict";

/**
 * @lqmnwido/dreams-ai-skills
 *
 * Per-repository governance skills for the D-ReAMS micro-frontend platform.
 *
 * This package is deliberately not global. The global harness
 * (`@lqmnwido/global-ai-agents`) decides how to work in general; this package
 * decides what is true about *this* repository. A remote module has a federation
 * contract with the Shell and a package version constraint on `@2enapps/ui`.
 * The backend behind it has neither. Those facts must live in the repository
 * they constrain, not in a home directory shared with unrelated projects.
 *
 * Usage:
 *
 *   npx -y @lqmnwido/dreams-ai-skills                # install into ./ (interactive)
 *   npx -y @lqmnwido/dreams-ai-skills --force        # overwrite a previous install
 *   npx -y @lqmnwido/dreams-ai-skills --check        # verify an existing install
 *   npx -y @lqmnwido/dreams-ai-skills --uninstall    # remove what this package wrote
 *
 * Programmatic use:
 *
 *   const skills = require("@lqmnwido/dreams-ai-skills");
 *   const report = skills.detect(process.cwd());
 *   const { flow, questions } = skills.buildFlow(report);
 */

const fs = require("fs");
const path = require("path");

const paths = require("./lib/paths");
const detectLib = require("./lib/detect");
const renderLib = require("./lib/render");
const questionsLib = require("./lib/questions");
const promptLib = require("./lib/prompt");
const namingLib = require("./lib/naming");
const scaffoldLib = require("./lib/scaffold");
const readmeLib = require("./lib/readme");
const minioLib = require("./lib/minio");
const featuresLib = require("./lib/features");
const reviewLib = require("./lib/review");

const VERSION = require("./package.json").version;

const TEMPLATES_DIR = path.join(__dirname, "templates");

/** Read every template file under `templates/`, keyed by posix relative path. */
function collectTemplates(subdir = "") {
  const root = subdir ? path.join(TEMPLATES_DIR, subdir) : TEMPLATES_DIR;
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

/** Flatten the governance tree into `agent-doc-path → content`. */
function collectGovernanceTemplates() {
  return collectTemplates(paths.GOVERNANCE_SUBDIR);
}

function collectAgentsTemplate() {
  const file = path.join(TEMPLATES_DIR, paths.AGENTS_FILENAME);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}

/**
 * The raw material of a new repository: every scaffold template keyed by its
 * path *before* `__SUB__` expansion. Pass `"fe"` or `"be"` for one half; pass
 * nothing for both, prefixed. Exposed so a caller can inspect what a
 * `module-pair` would produce without producing it.
 */
function collectScaffoldTemplates(half = null) {
  const fe = collectTemplates(path.join("scaffold", "fe"));
  const be = collectTemplates(path.join("scaffold", "be"));

  if (half === "fe") return fe;
  if (half === "be") return be;

  const all = {};
  for (const [key, value] of Object.entries(fe)) all[`fe/${key}`] = value;
  for (const [key, value] of Object.entries(be)) all[`be/${key}`] = value;
  return all;
}

/** The manifest the checker and the README both read. */
function manifest() {
  const files = [];
  for (const section of paths.SECTIONS) {
    for (const file of section.files) {
      files.push({
        section: section.id,
        sectionTitle: section.title,
        gate: section.gate,
        path: path.posix.join(section.id, file),
        exists: fs.existsSync(path.join(TEMPLATES_DIR, paths.GOVERNANCE_SUBDIR, section.id, file))
      });
    }
  }
  return { version: VERSION, marker: paths.MARKER, files };
}

/** Absolute destination of a generated governance document inside `cwd`. */
function destinationFor(cwd, relativeToGovernanceDir) {
  return path.join(cwd, paths.GOVERNANCE_DIR, relativeToGovernanceDir);
}

module.exports = {
  VERSION,
  MARKER: paths.MARKER,
  DOCS_DIR: paths.DOCS_DIR,
  GOVERNANCE_SUBDIR: paths.GOVERNANCE_SUBDIR,
  GOVERNANCE_DIR: paths.GOVERNANCE_DIR,
  AGENTS_FILENAME: paths.AGENTS_FILENAME,
  SECTIONS: paths.SECTIONS,
  PIPELINE: paths.PIPELINE,
  MODULE_KINDS: paths.MODULE_KINDS,
  SCOPE_KINDS: paths.SCOPE_KINDS,
  SCAFFOLD_KINDS: paths.SCAFFOLD_KINDS,
  README_BLOCKS: paths.README_BLOCKS,
  MODULE_ENV_PREFIX: paths.MODULE_ENV_PREFIX,

  detect: detectLib.detect,
  render: renderLib.render,
  renderTree: renderLib.renderTree,
  collectTokens: renderLib.collectTokens,
  reportableTokens: renderLib.reportable,
  buildFlow: questionsLib.buildFlow,
  buildContext: questionsLib.buildContext,
  deriveIdentity: questionsLib.deriveIdentity,
  questions: questionsLib,
  createPrompter: promptLib.createPrompter,
  UNANSWERED: promptLib.UNANSWERED,

  review: reviewLib,
  LEVELS: reviewLib.LEVELS,
  REVIEW_STEPS: reviewLib.STEPS,
  levelFor: reviewLib.levelFor,
  levelInfo: reviewLib.levelInfo,

  naming: namingLib,
  scaffold: scaffoldLib,
  readme: readmeLib,
  minio: minioLib,
  features: featuresLib,

  collectTemplates,
  collectGovernanceTemplates,
  collectAgentsTemplate,
  collectScaffoldTemplates,
  manifest,
  destinationFor,
  allGovernanceFiles: paths.allGovernanceFiles
};
