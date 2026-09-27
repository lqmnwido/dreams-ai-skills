# @lqmnwido/dreams-ai-skills

Per-repository AI governance skills for the **D-ReAMS** micro-frontend platform.

Run it once, inside a repository. It writes `AGENTS.md` and a
`.docs/project-governance/` tree — 33 documents — that tell any AI coding agent
what is true about _this_ repository before it touches a line of code.

Point it at an empty directory with `--kind=module-pair` and it scaffolds the
two repositories a new module is made of, writes a generated routes/API table
into each README, and stands up the module's own MinIO bucket.

Before each of its eight stages it prints what that stage is about to write —
real paths, real counts — and asks whether to go **1** (Recommended),
**2** (Economy) or **3** (Full). A level changes how much is scaffolded and how
much is reported. It never changes the 33 governance documents.

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

| Writes                                                                              | Never writes                                |
| ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `AGENTS.md` (root)                                                                  | any source file it did not scaffold         |
| `.docs/project-governance/**` (33 documents + README)                               | `package.json`, or any dependency           |
| `.docs/install.json` (state, the answers, the hashes, the review decisions)         | a `postinstall` hook                        |
| `README.md` — a routes/API table between markers, and at Full a workspace inventory | anything outside the current directory      |
| `<slug>_fe/`, `<slug>_be/` — only when `--parts` asks                               | an existing file, without `--force`         |
| a MinIO container — only after you say yes                                          | a MinIO container, in a non-interactive run |
| nothing at all, until a stage has been announced and a level chosen                 | a governance document, at any level         |

No `postinstall` script, deliberately: a documentation package must not change
how your project behaves just by being present in `node_modules`.

Every generated file carries `<!-- managed-by: @lqmnwido/dreams-ai-skills -->`,
so uninstall knows exactly which files are its own. Scaffolded files carry a
sha256 instead — they are source, and source is edited.

---

## Install

```sh
cd /path/to/repository

npx -y @lqmnwido/dreams-ai-skills                       # interactive, asked at every stage
npx -y @lqmnwido/dreams-ai-skills --force              # overwrite a previous install (.bak kept)
```

The installer **first detects what the repository is**, prints the evidence, and
only then asks anything. Detection is evidence-based — the verdict is always
accompanied by the lines that produced it, so a wrong classification is visible
rather than silently baked into thirty documents.

## Review: you choose, before every stage

Nothing is written before you have been told what is about to be written. Before
each of the eight stages the installer prints what that stage will produce — real
paths, real counts — and then asks:

```
  ── Review · 5. Scaffold ───────────────────────────────────────────────
    This step will:
      · create module_demo_fe/ — the widest scope, 19 file(s)
      · create module_demo_be/ — the widest scope, 26 file(s)

    1) Recommended  41 file(s) in module_demo_fe and module_demo_be — with the
                     test sources, so `mvn verify` is the gate it claims to be
    2) Economy      38 file(s) … no test sources and no .editorconfig; the build
                     still runs spotless, checkstyle and spotbugs
    3) Full         45 file(s) … plus a CI workflow per repository, a CHANGELOG,
                     pinned tool versions and the inventory table in each README

    Choose 1-3, or press enter for Recommended:
```

The levels are the same three throughout, but they mean different things in
different stages: a level only changes _scope_ where a stage writes, and
_verbosity_ where a stage reads.

| Stage      | Economy                                                          | Recommended                                 | Full                                                                                            |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Detection  | the verdict and the one rule behind it                           | the verdict and every reason                | + env keys, API bases, source counts                                                            |
| Intake     | ask nothing; derive from flags, the last install, the repository | the flow's questions                        | + a confirmation of every detected identity value, and which values were read rather than typed |
| Plan       | one line: files, holes                                           | + every unresolved placeholder by name      | + which document each placeholder sits in                                                       |
| Governance | **the same 33 documents**                                        | the same 33, one line per file              | + a per-section tally of what is still open                                                     |
| Scaffold   | no test sources, no `.editorconfig`                              | with the test sources                       | + CI, CHANGELOG, pinned tool versions, inventory tables                                         |
| README     | no generated table                                               | routes + API tables                         | + the workspace inventory                                                                       |
| MinIO      | do not look                                                      | detect, ask, then create                    | + a write and a delete, so "created" is proved                                                  |
| Result     | the counts                                                       | the identity, the counts, every placeholder | + every review decision, and who made it                                                        |

**A level never shrinks the governance tree.** All 33 documents are written at
every level, and no rule inside them changes. A missing document is not a lighter
install; it is a hole an agent reads as a fact.

Every decision is recorded in `.docs/install.json` with its source, so a later
run — or a reviewer — can tell an approval from an assumption:

```json
"readme": { "level": "full", "digit": 3, "source": "asked" }
"minio":  { "level": "recommended", "digit": 1, "source": "not applicable" }
```

`asked` is a person at a terminal. `assumed` is a pipeline with nobody to ask.
`--level` is a flag. `--no-review` is a flag. A terminal that closed before
anyone answered is `assumed`, not `asked` — that distinction is the whole point of
recording it.

```sh
npx -y @lqmnwido/dreams-ai-skills --level=economy     # answer every gate with Economy
npx -y @lqmnwido/dreams-ai-skills --no-review         # do not ask, do not print the gates
```

A non-interactive run (`--yes`, `--dry-run`, CI) never asks. It uses `--level` if
given, otherwise Recommended, and prints which one it used and why. It never
silently guesses: `--level=nonsense` is reported and falls back to Recommended,
not to the first thing in the list.

| Detected        | When                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| `new`           | no `package.json`, no `vue.config.js`, no governance tree              |
| `shell`         | `ModuleFederationPlugin` with `name: "shell"`                          |
| `remote-module` | any other federation name, or a `remoteName` in `src/metadata.js`      |
| `shared-ui`     | `package.json` name is `@2enapps/ui`                                   |
| `backend-api`   | a server framework and no Vue CLI entry point                          |
| `module-pair`   | a `*_fe` directory beside a `*_be`, each with the build file it claims |
| `unclassified`  | D-ReAMS-adjacent but ambiguous — it asks, it does not guess            |

### Re-running

A second run is idempotent, and it is safe specifically because the identity is
_remembered_ rather than re-derived. The module slug names two repositories and
an object-storage bucket; deriving it again from the current directory would
quietly produce `module_fe` where the first run wrote `module_demo_fe` and
create a second pair of repositories nobody asked for.

Priority, highest first: **a flag → a typed answer → the previous install → a
derived default.** Every value the previous install supplied and this run did
not replace is printed as `carried from the previous install`.

## The two intake flows

The difference between these is the main reason the detection step exists.

**A new repository has no identity**, so it is asked for one:

> scope → kind → module name → display name → slug → scaffold parts →
> sub-module(s) → use case → route prefix → role id → port → backend port →
> API bases → Shell repository → UI dependency

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

| Flag                              | Flag                        | Flag               |
| --------------------------------- | --------------------------- | ------------------ |
| `--scope=<id>`                    | `--module=<name>`           | `--apis=<A,B>`     |
| `--kind=<id>`                     | `--display=<label>`         | `--shell=<path>`   |
| `--slug=<slug>`                   | `--route-prefix=/x`         | `--ui-dep=<value>` |
| `--parts=<id>`                    | `--role=<roleId>`           | `--name=<repo>`    |
| `--submodule=<a,b>`               | `--port=<port\|n/a>`        | `--owner=<name>`   |
| `--usecase=<text>` _(repeatable)_ | `--backend-port=<port>`     | `--deploy=<id>`    |
| `--blast-radius=<a,b>`            | `--confirm-identity=<bool>` |                    |

Behaviour flags: `--level=<id> --no-review --yes --force --dry-run --check
--uninstall --quiet --help`, plus `--minio=<mode>`, `--bucket=<name>` and
`--no-readme` (below).

`--confirm-identity=false` overrides the detected identity with the flags you
pass, for the case where the repository has drifted from what it should be.

## A new module, in one command

```sh
mkdir module-demo && cd module-demo

npx -y @lqmnwido/dreams-ai-skills --yes \
  --scope=new-feature --kind=module-pair \
  --module=module-demo --display="Module Demo" --slug=module-demo \
  --parts=both \
  --submodule="program/senarai-program,program/maklumat-program" \
  --usecase="What this module is for" \
  --route-prefix=/module-demo --role=adminModuleDemo \
  --port=3002 --backend-port=8081
```

| `--parts=`                              | Creates                                            |
| --------------------------------------- | -------------------------------------------------- |
| `both` _(default for `module-pair`)_    | `module_demo_fe` and `module_demo_be`, as siblings |
| `frontend`                              | `module_demo_fe` only                              |
| `backend`                               | `module_demo_be` only                              |
| `docs` _(default for every other kind)_ | governance documents only                          |

One slug decides four names, so they cannot drift apart:

```
module-demo  →  bucket module-demo
             →  repositories module_demo_fe / module_demo_be
             →  Java package com.dreams.module_demo
             →  API base /api/module-demo, env VUE_APP_URL_MODULE_DEMO
```

The frontend is a real Module Federation remote: exposes, router, metadata,
preview entry, Prettier + ESLint, and its own `.env` pointing at this module's
backend. The backend is Spring Boot 3 on Java 21 — controller, domain service,
storage port, MinIO adapter, `@RestControllerAdvice`, `.env` loaded through
Spring's `EnvironmentPostProcessor` SPI, and a build that runs
`spotless:check → checkstyle → tests → spotbugs`.

### What each level scaffolds

For a `module-pair` with one sub-module, `--parts=both`:

| Level       | Frontend | Backend | Total  | Difference                                                                                                                         |
| ----------- | -------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Economy     | 16       | 21      | **37** | no `src/test/**`, no `.editorconfig`                                                                                               |
| Recommended | 16       | 24      | **40** | test sources, so `mvn verify` is the gate the README claims                                                                        |
| Full        | 18       | 26      | **44** | + `.github/workflows/verify.yml` and `CHANGELOG.md` per repository, + pinned plugin versions, + the inventory table in each README |

One file is added per additional sub-module (a view and its route), so a
two-sub-module module pair is 38 / 41 / 45.

A level that dropped a file also drops the sentence that mentions it. The Economy
`pom.xml` carries no test dependency, no test source directory and no test
include — because a build that says `mvn verify` on a repository with no tests is
a sentence about a thing that does not exist. `npm test` asserts that, at every
level, for the build and for the README.

Both are written with `writeFileSafe`: an existing file is kept, and `--force`
backs it up before replacing. Scaffolding is not a case where the installer
overwrites a repository you have already started.

## The generated README table

Every module README carries its contract between markers:

```markdown
<!-- routes:start -->

| Route | Name | View |
| ----- | ---- | ---- |

<!-- routes:end -->
```

| Table                      | Written to                                       | Read from                                                        |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| `<!-- routes:start -->`    | `<slug>_fe/README.md` (or the repository itself) | `vue.config.js` exposes, or the router                           |
| `<!-- api:start -->`       | `<slug>_be/README.md` (or the repository itself) | the Spring `@*Mapping` annotations                               |
| `<!-- workspace:start -->` | `README.md` in the run directory                 | the intake — which repository is which, and what each one is for |

The first two are read out of code and can therefore go stale, so `check` reports
a drift. The workspace inventory is read out of the answers, so it cannot go stale
on its own — it changes when you re-run the installer with different flags, and
that is stated in the block itself.

Content outside the markers is yours and is never touched. A `README.md` that
does not exist is created with the heading and the block; anything else gains a
block at the end. `--no-readme` leaves both files alone.

Rows read out of code are labelled as such; when a repository has no router or
no controller yet, the table falls back to what the governance tree declares and
says so in the block, rather than presenting an empty table or an invented one.

## Object storage

A module's uploads go to a bucket named after the module, in MinIO locally.

```sh
npx -y @lqmnwido/dreams-ai-skills --minio=install
```

| `--minio=`         | Behaviour                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `auto` _(default)_ | Detect. If MinIO is absent, ask in a terminal. In a non-interactive run, print the commands and do nothing |
| `install`          | Start MinIO in Docker and create the bucket — explicit consent, usable from a script                       |
| `check`            | Report status only                                                                                         |
| `skip`             | Do not look                                                                                                |

**A non-interactive run never installs anything.** A pipeline cannot grant
permission on anyone's behalf, so it prints instead of acting. Detection probes
`http://localhost:9000/minio/health/live` — the only signal that matters, since
a container that exists but is stopped stores nothing — and bucket creation is
an idempotent signed `PUT`, so an existing bucket is reported, not recreated.

At **Economy** the whole stage is skipped: the service still reads
`MINIO_BUCKET` from its own `.env`, so nothing breaks, and nobody's machine has a
container started behind their back. At **Full** the bucket is proved after it is
created — one signed `PUT` and one `DELETE` of a probe object — because "created"
is a claim, and a claim nobody checked is how a module ships with uploads that
fail only in production.

Data lives in `~/.dreams/minio-data`, outside the repository on purpose: a data
directory inside a git working tree either ends up committed or ends up in
`.gitignore` and then lost between machines.

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

Eight classes of problem, all offline and cheap:

1. **Structure** — all 34 documents present, `AGENTS.md` links resolve
2. **Identity drift** — `vue.config.js`, `src/metadata.js` and the documents
   disagreeing about the remote name, the shared singletons or `@2enapps/ui`
3. **Unresolved placeholders** — counted, per token, as a warning
4. **Pipeline coverage** — the governance README documents all 11 stages
5. **README tables** — markers paired, and the rows still matching the code
6. **Uploads and storage** — upload paths, object-storage clients, and which
   bucket the configuration actually names
7. **Module environment** — `.env` exists, `.gitignore` ignores it, the bucket
   matches the documented one, the module declares its own `VUE_APP_URL_*`
8. **Detection freshness** — the repository no longer classifies as it did

Exit code 0 means healthy. The point is to fail _before_ an agent starts working,
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
- A **generated README table** is removed; the README around it is not. A
  scaffolded README with nothing else in it goes, because there is nothing in it.
- A **scaffolded file** is removed only while its sha256 still matches what the
  scaffold wrote. Anything you have since implemented stays where it is, and is
  reported as kept.
- Files in `.docs` this package did not write are listed and kept.

---

## The generated tree

Thirty-three documents, ordered governance → delivery → operations → backend.

```
AGENTS.md                              the router: detect, intake, route, report
README.md                              routes / API table, between markers
.docs/project-governance/
├── README.md
├── 01-product/          PRD · SCOPE · CHANGE-REQUEST
├── 02-governance/       STANDARDS · GUARDRAILS · QUALITY · ANTI-SLOP · SECURITY
├── 03-architecture/     ARCHITECTURE · API-CONTRACT · INTEGRATION · AUTHENTICATION · ADR
├── 04-design/           DESIGN · UI-STANDARD · TEMPLATE
├── 05-development/      DEVELOPMENT · FORMAT-LINT · TOOLS · REPOSITORY-STANDARD
├── 06-quality/          AUDIT · CHECK · TESTING · DEBUG
├── 07-delivery/         DEPLOYMENT · VERSIONING · SYNC · RELEASE
├── 08-operations/       MONITORING · INCIDENT · RUNBOOK
└── 09-backend/          SPRING-BOOT · STORAGE
```

The five documents that carry the most weight in this platform:

| Document                          | Why it exists                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `03-architecture/API-CONTRACT.md` | The frontend and the backend are separate repositories. Neither can see the other; this file is the only shared truth about a request or a response. |
| `02-governance/GUARDRAILS.md`     | What must never happen: a second Keycloak client, a second Pinia, a feature page in the Shell, a route guard treated as the security boundary.       |
| `02-governance/ANTI-SLOP.md`      | What this repository refuses to accept — and, honestly, which of those rules no tool can enforce.                                                    |
| `07-delivery/SYNC.md`             | The compatibility matrix and the update process for `@2enapps/ui`. Major versions are never upgraded automatically, and one repository at a time.    |
| `09-backend/STORAGE.md`           | One bucket per module, named by the slug, written to only through this module's own service.                                                         |

### The pipeline

`AGENTS.md` states the order, and it is the same order for a new feature, a
Change Request and a debug session:

```
PRD → SCOPE → AUDIT → ARCHITECT → DEVELOP → CHECK → TEST → DEBUG → DOCUMENT → SYNC → RELEASE
```

A Change Request or a debug run starts at step 3, with a fresh entry in
`01-product/CHANGE-REQUEST/` or `06-quality/DEBUG.md` — **one file per request,
never a single overwritten file.** The history is the point.

**Every stage needs a human sign-off before the next one starts.** An agent
proposes; a person approves. `AGENTS.md` §2.1 says what counts as one: the person
has seen the artefact itself, answered what changes for a user and what breaks if
this is wrong, and said yes somewhere that can be found again. Silence is not a
yes, a green pipeline is not a yes, and the agent that produced the artefact may
not be the one that signs it off. That last rule is what makes the other two
mean anything.

## Programmatic use

```js
const skills = require("@lqmnwido/dreams-ai-skills");

const report = skills.detect(process.cwd());
console.log(report.kind, report.reasons, report.federation.exposes);

const { flow, questions } = skills.buildFlow(report);
const context = skills.buildContext(report, { MODULE_NAME: "v2t" });
const { files, unresolved } = skills.renderTree(
  skills.collectGovernanceTemplates(),
  context,
);

// A repository's routes and endpoints, read from the code that declares them
skills.readme.detectRoutes(process.cwd());
skills.readme.detectApis("/path/to/service");

// What a `module-pair` would create, without creating it
skills.scaffold.plan(context).files; // Recommended
skills.scaffold.plan(context, { level: "economy" }); // 37 files
skills.scaffold.plan(context, { level: "full" }); // 44 files, with CI
skills.collectScaffoldTemplates(); // fe/... and be/... template source

// The review gates, without running them
skills.LEVELS; // [{ digit: 1, id: "recommended" }, …]
skills.REVIEW_STEPS; // the 8 gated stages, in order
skills.levelFor("2"); // "economy"
skills.levelFor("nonsense"); // null
const review = skills.review.createReview({ flags, prompter, interactive });
await review.gate({ id: "scaffold", title: "5. Scaffold", writes, effects });
review.summary(); // { default, levels, pinned, steps: { … } }
```

Also exported: `manifest()`, `render()`, `collectTokens()`, `reportableTokens()`,
`deriveIdentity()`, `createPrompter()`, `levelInfo()`, `questions`, `naming`,
`readme`, `scaffold`, `minio`, `features`, `SECTIONS`, `PIPELINE`,
`MODULE_KINDS`, `SCOPE_KINDS`, `SCAFFOLD_KINDS`, `README_BLOCKS`.

---

## Development

```sh
npm test          # node bin/check.js --self
```

`npm test` validates the package against itself:

- every template document exists, and `AGENTS.md` references only documents
  that exist (34 links);
- the governance README documents all 11 pipeline stages;
- the renderer both substitutes and preserves;
- a full `module-pair` scaffold **expands with no unresolved paths or tokens**;
- the expanded controller **reads back through `detectApis`** to exactly the
  three endpoints the README table documents, and the expanded `vue.config.js`
  reads back through `detectRoutes` — a table generated from annotations that
  cannot be parsed would be wrong on its first run;
- the three levels produce **37 / 40 / 44 files**, in that order, and each level's
  build describes itself accurately — the Economy `pom.xml` has no test
  dependency, no test include and no test directory; the Recommended and Full
  ones have all three; only Full has CI, a CHANGELOG and an inventory table;
- the review gates return what a digit says they return, record `asked` for a
  person and `assumed` for a pipeline that had nobody to ask, refuse to be quiet
  without saying so, and **cover every stage the installer announces** — the two
  lists are read against each other, so a new stage without a gate fails here;
- `levelFor` maps `2`, `economy` and `Full` to levels and `nonsense` to `null`;
- the intake grows at Full and is identical at Economy and Recommended, and every
  Full-only question has a detected default to offer rather than asking somebody
  to retype what the machine already read;
- `AGENTS.md` carries the human sign-off gate, the three levels, and the rule
  that a level never removes a document;
- every README block mode — routes, api, workspace — pairs and names the module;
- no function in `bin/check.js` is declared twice, because hoisting makes the
  later one silently win at every call site;
- the MinIO instructions name this module's bucket rather than a generic one, and
  no template carries a filename npm would refuse to publish.

### Layout

```
index.js                 public API and manifest()
lib/paths.js             MARKER, SECTIONS, PIPELINE — the single source of truth
lib/detect.js            evidence-based repository classification
lib/questions.js         the two intake flows, their levels, defaults, derived context
lib/review.js            LEVELS, the 8 gated stages, and the gate itself
lib/prompt.js            TTY and non-TTY prompting
lib/render.js            {{TOKEN}} substitution, preserving what it cannot fill
lib/naming.js            slug / snake / pascal / package / bucket derivations
lib/scan.js              bounded file walking
lib/features.js          upload and object-storage evidence, with addresses
lib/readme.js            routes/API/workspace detection and marker-block README writes
lib/scaffold.js          level-aware planning and expanding a new repository pair
lib/minio.js             detect, install, create and prove a bucket (hand-rolled SigV4)
templates/AGENTS.md      the generated router
templates/project-governance/**   the 33 documents
templates/scaffold/fe/**          the frontend repository template
templates/scaffold/be/**          the backend repository template
```

`lib/paths.js` is the single source of truth for the tree, the pipeline order and
the module kinds. `bin/check.js` and the README both read it, so a document
cannot be added to the filesystem without appearing in the manifest, or
mentioned in `AGENTS.md` without existing.

## Licence

MIT — see [LICENSE](LICENSE).

Version 0.1.0 was published with `"license": "UNLICENSED"`, which is npm's way of
saying *do not use this*. It is an accidental setting rather than a decision, and it
is corrected from 0.1.1.
