# @lqmnwido/dreams-ai-skills

Per-repository AI governance skills for the **D-ReAMS** micro-frontend platform.

Run it once, inside a repository. It writes `AGENTS.md` and a
`.docs/project-governance/` tree — 30 documents — that tell any AI coding agent
what is true about *this* repository before it touches a line of code.

```sh
npx -y @lqmnwido/dreams-ai-skills
```

---

## Why per-repository, and not global

The global harness (`@lqmnwido/global-ai-agents`) decides **how** to work. This
package records **what is true here**.

Those are different things, and the difference is the whole point. A frontend
module has a Module Federation contract with the Shell — an expose key that must
match an import string exactly, four shared singletons that must resolve to one
instance, a port, a route prefix, a role id, a set of `VUE_APP_*` API bases
compiled into that module alone. A backend API has none of those and has a
contract the frontend must not guess.

Facts like those belong in the repository they constrain. In a shared home
directory they would be a plausible-looking file about a project you are not
working on, which is worse than no file at all.

## What it writes — and what it does not

| Writes | Never writes |
| --- | --- |
| `AGENTS.md` (root) | any source file |
| `.docs/project-governance/**` (30 documents) | `package.json`, or any dependency |
| `.docs/install.json` (state, for `check`) | a `postinstall` hook |
| | anything outside the current directory |

No `postinstall` script, deliberately: a documentation package must not change
how your project behaves just by being present in `node_modules`.

Every generated file carries `<!-- managed-by: @lqmnwido/dreams-ai-skills -->`, so
uninstall knows exactly which files are its own.

---

## Install

```sh
cd /path/to/your/repository

npx -y @lqmnwido/dreams-ai-skills                       # interactive
npx -y @lqmnwido/dreams-ai-skills --dry-run             # show the plan, write nothing
npx -y @lqmnwido/dreams-ai-skills --yes                # non-interactive, derived answers only
npx -y @lqmnwido/dreams-ai-skills --force              # overwrite a previous install (.bak kept)
```

The installer **first detects what the repository is**, prints the evidence, and
only then asks anything. Detection is evidence-based — the verdict is always
accompanied by the lines that produced it, so a wrong classification is visible
rather than silently baked into thirty documents.

| Detected | When |
| --- | --- |
| `new` | no `package.json`, no `vue.config.js`, no governance tree |
| `shell` | `ModuleFederationPlugin` with `name: "shell"` |
| `remote-module` | any other federation name, or a `remoteName` in `src/metadata.js` |
| `shared-ui` | `package.json` name is `@2enapps/ui` |
| `backend-api` | a server framework and no Vue CLI entry point |
| `unclassified` | D-ReAMS-adjacent but ambiguous — it asks, it does not guess |

## The two intake flows

The difference between these is the main reason the detection step exists.

**A new repository has no identity**, so it is asked for one:

> scope → kind → module name → display name → sub-module(s) → use case →
> route prefix → role id → port → API bases → Shell repository → UI dependency

**An existing module already has one**, and asking a human to retype it is noise
at best and a silent federation break at worst. So identity is read from the
repository and presented as a confirmation, and only the questions that genuinely
need a person are asked:

> scope → confirm the detected identity → which sub-module(s) → the use case or
> the defect → which other repositories this touches

Read from the repository, never asked: the remote name, the expose keys, the
shared singletons, the `@2enapps/ui` dependency, the `VUE_APP_URL_*` bases, the
route prefix, the role.

Every question has a matching flag, so the whole flow is scriptable — and
`--usecase` is repeatable, one flag per point:

```sh
npx -y @lqmnwido/dreams-ai-skills --yes \
  --module=laporan --display=Laporan \
  --submodule=laporan/bulanan,rekap/tahunan \
  --usecase="Monthly reporting for programme managers" \
  --usecase="Rekap tahunan untuk Vodafone" \
  --route-prefix=/laporan --role=adminlaporan --port=3005 \
  --apis=VUE_APP_URL_KOD,VUE_APP_URL_ASR
```

| Flag | Flag | Flag |
| --- | --- | --- |
| `--scope=<id>` | `--module=<name>` | `--apis=<A,B>` |
| `--kind=<id>` | `--display=<label>` | `--shell=<path>` |
| `--submodule=<a,b>` | `--route-prefix=/x` | `--ui-dep=<value>` |
| `--usecase=<text>` *(repeatable)* | `--role=<roleId>` | `--name=<repo>` |
| `--port=<port\|n/a>` | `--blast-radius=<a,b>` | `--owner=<name>` |
| `--deploy=<id>` | `--confirm-identity=<bool>` | |

`--confirm-identity=false` overrides the detected identity with the flags you
pass, for the case where the repository has drifted from what it should be.

## Unresolved values stay visible

Anything the installer could not determine is written as `{{TOKEN}}` and listed
once at the end. It is never replaced with a plausible guess.

> A wrong remote name is not a lint error — it is a runtime failure in the Shell
> with a misleading message. A guessed role id is a silent authorization
> difference. A visible placeholder is greppable, impossible to mistake for
> content, and cheap to fill. A plausible fabrication is none of those.

```sh
grep -rn '{{[A-Z_]*}}' .docs AGENTS.md
```

## Check

```sh
npx -y @lqmnwido/dreams-ai-skills --check
```

Four classes of problem, all offline and cheap:

1. **Structure** — all 30 documents present, `AGENTS.md` links resolve
2. **Identity drift** — `vue.config.js`, `src/metadata.js` and the documents
   disagreeing about the remote name, the shared singletons or `@2enapps/ui`
3. **Unresolved placeholders** — counted, per token, as a warning
4. **Pipeline coverage** — the governance README documents all 11 stages

Exit code 0 means healthy. The point is to fail *before* an agent starts working,
not after it has relied on a document describing a route nobody registered.

## Uninstall

```sh
npx -y @lqmnwido/dreams-ai-skills --uninstall
npx -y @lqmnwido/dreams-ai-skills --uninstall --purge   # also remove foreign files in .docs
```

Removal is narrow on purpose. A governance tree is edited by hand, and
`CHANGE-REQUEST/`, `AUDIT` and `ADR` entries are often the only record of why a
decision was made:

- A document that **matches what the installer wrote** (by sha256, recorded in
  `.docs/install.json`) is removed.
- A document that was **edited by hand** is moved to `.docs/.removed/` — never
  deleted.
- A root `AGENTS.md` **without** the marker is left completely alone: if you wrote
  it yourself, it is yours.
- Files in `.docs` this package did not write are listed and kept.

---

## The generated tree

Thirty documents, ordered governance → delivery → operations.

```
AGENTS.md                              the router: detect, intake, route, report
.docs/project-governance/
├── README.md
├── 01-product/          PRD · SCOPE · CHANGE-REQUEST
├── 02-governance/       STANDARDS · GUARDRAILS · QUALITY · SECURITY
├── 03-architecture/     ARCHITECTURE · API-CONTRACT · INTEGRATION · AUTHENTICATION · ADR
├── 04-design/           DESIGN · UI-STANDARD · TEMPLATE
├── 05-development/      DEVELOPMENT · TOOLS · REPOSITORY-STANDARD
├── 06-quality/          AUDIT · CHECK · TESTING · DEBUG
├── 07-delivery/         DEPLOYMENT · VERSIONING · SYNC · RELEASE
└── 08-operations/       MONITORING · INCIDENT · RUNBOOK
```

The four documents that carry the most weight in this platform:

| Document | Why it exists |
| --- | --- |
| `03-architecture/API-CONTRACT.md` | The frontend and the backend are separate repositories. Neither can see the other; this file is the only shared truth about a request or a response. |
| `02-governance/GUARDRAILS.md` | What must never happen: a second Keycloak client, a second Pinia, a feature page in the Shell, a route guard treated as the security boundary. |
| `07-delivery/SYNC.md` | The compatibility matrix and the update process for `@2enapps/ui`. Major versions are never upgraded automatically, and one repository at a time. |
| `06-quality/AUDIT.md` | What existed **before** development started. Written first, not last. |

### The pipeline

`AGENTS.md` states the order, and it is the same order for a new feature, a
Change Request and a debug session:

```
PRD → SCOPE → AUDIT → ARCHITECT → DEVELOP → CHECK → TEST → DEBUG → DOCUMENT → SYNC → RELEASE
```

A Change Request or a debug run starts at step 3, with a fresh entry in
`01-product/CHANGE-REQUEST/` or `06-quality/DEBUG.md` — **one file per request,
never a single overwritten file.** The history is the point.

## Programmatic use

```js
const skills = require("@lqmnwido/dreams-ai-skills");

const report = skills.detect(process.cwd());
console.log(report.kind, report.reasons, report.federation.exposes);

const { flow, questions } = skills.buildFlow(report);
const context = skills.buildContext(report, { MODULE_NAME: "v2t" });
const { files, unresolved } = skills.renderTree(
  skills.collectGovernanceTemplates(),
  context
);
```

Also exported: `manifest()`, `render()`, `collectTokens()`, `reportableTokens()`,
`deriveIdentity()`, `createPrompter()`, `SECTIONS`, `PIPELINE`, `MODULE_KINDS`,
`SCOPE_KINDS`.

---

## Development

```sh
npm test          # node bin/check.js --self — manifest, router links, renderer
```

`npm test` validates the package against itself: that every template exists,
that `AGENTS.md` references only documents that exist, that the governance README
documents all 11 pipeline stages, and that the renderer both substitutes and
preserves.

### Layout

```
index.js              public API and manifest()
lib/paths.js          MARKER, SECTIONS, PIPELINE — the single source of truth
lib/detect.js         evidence-based repository classification
lib/questions.js      the two intake flows, defaults and derived context
lib/prompt.js         TTY and non-TTY prompting
lib/render.js         {{TOKEN}} substitution, preserving what it cannot fill
templates/AGENTS.md   the generated router
templates/project-governance/**   the 30 documents
```

`lib/paths.js` is the single source of truth for the tree, the pipeline order and
the module kinds. `bin/check.js` and the README both read it, so a document
cannot be added to the filesystem without appearing in the manifest, or
mentioned in `AGENTS.md` without existing.

## Licence

UNLICENSED — internal to 2enapps.
