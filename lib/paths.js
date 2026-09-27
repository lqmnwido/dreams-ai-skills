"use strict";

/**
 * File-system layout of the generated artefacts.
 *
 * The installer writes exactly two things into a target repository:
 *
 *   AGENTS.md                      the router every AI agent reads first
 *   .docs/project-governance/**    the governance tree
 *
 * Nothing else. The installer never touches source, never edits an existing
 * dependency, and never adds a `package.json` script. Anything the governance
 * tree asks a developer to run stays a documented command, not a silent
 * side effect of installing a documentation skill.
 */

const path = require("path");

const MARKER = "@lqmnwido/dreams-ai-skills";
const MARKER_COMMENT = `<!-- managed-by: ${MARKER} -->`;

const DOCS_DIR = ".docs";
const GOVERNANCE_SUBDIR = "project-governance";
const GOVERNANCE_DIR = path.posix.join(DOCS_DIR, GOVERNANCE_SUBDIR);
const AGENTS_FILENAME = "AGENTS.md";

/** The governance tree, in SDLC order. `index.js` uses this for the manifest. */
const SECTIONS = [
  {
    id: "01-product",
    title: "Product",
    gate: "Why and what",
    files: ["PRD.md", "SCOPE.md", "CHANGE-REQUEST.md"]
  },
  {
    id: "02-governance",
    title: "Governance",
    gate: "The rules that bind everyone",
    files: ["STANDARDS.md", "GUARDRAILS.md", "QUALITY.md", "SECURITY.md"]
  },
  {
    id: "03-architecture",
    title: "Architecture",
    gate: "How the pieces fit",
    files: ["ARCHITECTURE.md", "API-CONTRACT.md", "INTEGRATION.md", "AUTHENTICATION.md", "ADR.md"]
  },
  {
    id: "04-design",
    title: "Design",
    gate: "How it looks and behaves",
    files: ["DESIGN.md", "UI-STANDARD.md", "TEMPLATE.md"]
  },
  {
    id: "05-development",
    title: "Development",
    gate: "How the code gets written",
    files: ["DEVELOPMENT.md", "TOOLS.md", "REPOSITORY-STANDARD.md"]
  },
  {
    id: "06-quality",
    title: "Quality",
    gate: "How we know it is right",
    files: ["AUDIT.md", "CHECK.md", "TESTING.md", "DEBUG.md"]
  },
  {
    id: "07-delivery",
    title: "Delivery",
    gate: "How it reaches users",
    files: ["DEPLOYMENT.md", "VERSIONING.md", "SYNC.md", "RELEASE.md"]
  },
  {
    id: "08-operations",
    title: "Operations",
    gate: "How it stays healthy",
    files: ["MONITORING.md", "INCIDENT.md", "RUNBOOK.md"]
  }
];

/** The lifecycle, in the order work actually moves through it. */
const PIPELINE = [
  { step: "PRD", doc: "01-product/PRD.md", verb: "Define the problem and the value" },
  { step: "SCOPE", doc: "01-product/SCOPE.md", verb: "Decide what this repository owns" },
  { step: "AUDIT", doc: "06-quality/AUDIT.md", verb: "Record what exists today" },
  { step: "ARCHITECT", doc: "03-architecture/ARCHITECTURE.md", verb: "Design before writing code" },
  { step: "DEVELOP", doc: "05-development/DEVELOPMENT.md", verb: "Implement only the approved plan" },
  { step: "CHECK", doc: "06-quality/CHECK.md", verb: "Verify architecture, standards, security, dependencies" },
  { step: "TEST", doc: "06-quality/TESTING.md", verb: "Prove behaviour, whitebox and blackbox" },
  { step: "DEBUG", doc: "06-quality/DEBUG.md", verb: "Reproduce, hypothesise, fix" },
  { step: "DOCUMENT", doc: "ARCHITECTURE.md, API-CONTRACT.md, 04-design/", verb: "Update the documents the change invalidated" },
  { step: "SYNC", doc: "07-delivery/SYNC.md", verb: "Align versions across repositories" },
  { step: "RELEASE", doc: "07-delivery/RELEASE.md", verb: "Ship and record it" }
];

const MODULE_KINDS = [
  {
    id: "shell",
    label: "Shell / host",
    hint: "Authentication, navigation, routing, federation host entry",
    owns: "bootstrap, Keycloak, top-level router, shared singletons, remoteEntry host"
  },
  {
    id: "remote-module",
    label: "Frontend module (remote)",
    hint: "Feature views, feature services, exposed pages",
    owns: "exposes, preview entry, feature API calls, module translations"
  },
  {
    id: "shared-ui",
    label: "Shared UI package",
    hint: "Presentation components, layouts, stores, global styles",
    owns: "@2enapps/ui public API, styles, shared Pinia stores"
  },
  {
    id: "backend-api",
    label: "Backend API",
    hint: "The service the modules call",
    owns: "endpoints, authorization, validation, the API contract"
  }
];

const SCOPE_KINDS = [
  { id: "new-feature", label: "Add a feature", doc: "01-product/PRD.md", start: "new" },
  { id: "change-request", label: "Change Request (CR)", doc: "01-product/CHANGE-REQUEST.md", start: "existing" },
  { id: "debug", label: "Debug an existing defect", doc: "06-quality/DEBUG.md", start: "existing" }
];

function allGovernanceFiles() {
  const out = [];
  for (const section of SECTIONS) {
    for (const file of section.files) out.push(path.posix.join(section.id, file));
  }
  return out;
}

module.exports = {
  MARKER,
  MARKER_COMMENT,
  DOCS_DIR,
  GOVERNANCE_SUBDIR,
  GOVERNANCE_DIR,
  AGENTS_FILENAME,
  SECTIONS,
  PIPELINE,
  MODULE_KINDS,
  SCOPE_KINDS,
  allGovernanceFiles
};
