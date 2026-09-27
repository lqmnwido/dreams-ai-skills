<!-- managed-by: @lqmnwido/dreams-ai-skills -->
<!-- {{REPO_NAME}} · {{MODULE_DISPLAY}} · {{MODULE_KIND}} · installed {{INSTALL_DATE}} -->

# AGENTS.md — {{MODULE_DISPLAY}}

**This file is a router, not a rulebook.** It tells you which document answers
which question. The rules live in `.docs/project-governance/`. Read the relevant
one before acting; do not work from memory of this file.

You are working in **{{REPO_NAME}}**, the `{{MODULE_KIND}}` repository for
`{{MODULE_NAME}}` in the D-ReAMS platform. Its use case:

{{USE_CASE_LIST}}

---

## Section 0 — Load order and the minimum compliance set

On the first turn of any session, in this order:

1. This file, in full.
2. `02-governance/GUARDRAILS.md` — **binding, no exceptions.**
3. `01-product/SCOPE.md` — what this repository owns and, more importantly, what it does not.
4. The document for the task at hand (see the routing table).

Before you write a single line of code you must also have read, for the current
task:

- `06-quality/AUDIT.md` — what exists today
- `03-architecture/ARCHITECTURE.md` — the rules of the ecosystem
- `05-development/STANDARDS.md` if present, otherwise `02-governance/STANDARDS.md`

If any of those is missing, stop and say so. Do not proceed from an assumption.

---

## Section 1 — First action in this repository: classify, then intake

**Never assume you know whether this is a new repository or an existing module.
Determine it.** The two flows below are different, and running the wrong one is
the single most common way this harness gets misused.

**Everything you do is a stage, and every stage needs a human sign-off** (§2.1).
That includes the ones below: a classification you got wrong, a plan you built
without showing it, a document you filled in on somebody's behalf. Propose, then
wait. If the user asked for something small, that is still a proposal.

### 1.1 Detect

Run this classification before anything else. Report the verdict and the evidence
to the user in one short block, then follow the matching flow.

| Probe | Command / file | Evidence |
| --- | --- | --- |
| Is there a package? | `cat package.json` | `name`, `dependencies` |
| Is Module Federation declared? | `grep -n "ModuleFederationPlugin" vue.config.js` | presence |
| Who is the host/remote? | `grep -n -A3 "name:" vue.config.js` | `name: "shell"` or another remote name |
| Is there federation metadata? | `cat src/metadata.js` | `remoteName`, `routePrefix` |
| Does it consume shared UI? | `grep -n "@2enapps/ui" package.json` | git branch vs `file:` link vs absent |
| Is a governance tree already here? | `ls .docs/project-governance` | 33 documents or absent |
| Is it a service? | `ls main.py app.py main.go server.js cmd internal pom.xml build.gradle 2>/dev/null` | server framework |
| Is it a module workspace? | `ls -d *_fe *_be 2>/dev/null` | a `module-pair` produced by `--parts=both` |
| Does it upload? | `grep -rn "MultipartFile\|multipart/form-data\|type=\"file\"\|new FormData("` | an upload feature, and whether it has a storage client |

Then apply:

```
if  no package.json AND no vue.config.js AND no .docs/project-governance
    → NEW REPOSITORY                      (flow 1.2)

elif vue.config.js declares ModuleFederationPlugin with name: "shell"
    → EXISTING MODULE — the Shell/host    (flow 1.3)

elif a federation name other than "shell" is declared, or src/metadata.js has a remoteName
    → EXISTING MODULE — frontend remote   (flow 1.3)

elif package.json name is "@2enapps/ui"
    → EXISTING MODULE — shared UI package (flow 1.3)

elif a server framework is present and no Vue CLI entry point
    → EXISTING MODULE — backend API       (flow 1.3)

elif a `*_fe` directory sits beside a `*_be` directory
    → EXISTING MODULE — module workspace  (flow 1.3; kind `module-pair`)

else
    → UNCLASSIFIED — ask the user. Do not guess.
```

State the verdict as one line, then the evidence lines that produced it.

### 1.2 Flow A — NEW repository

Nothing exists yet, so establish identity before writing any governance content.
**Ask the user. Do not invent answers.** If the user declines a question, write
`{{TOKEN}}` for that value and say which document needs it.

Ask, in this order:

1. **What kind of work is this?**
   - `new-feature` — a capability that does not exist yet
   - `change-request` (CR) — changing something that already exists
   - `debug` — a defect in existing behaviour
2. **What kind of repository is this?**
   - `shell` — authentication, navigation, routing, federation host
   - `remote-module` — feature views and feature services, exposed to the Shell
   - `shared-ui` — the `@2enapps/ui` presentation package
   - `backend-api` — the service the modules call
   - `module-pair` — a new module made of both: `<slug>_fe` and `<slug>_be`,
     created as siblings in this directory (`--parts` narrows it to one)
3. **What is the module name?** The federation remote name, lowercase, no
   spaces. This string is a public contract: it is the left half of
   `<remote>/<expose-path>` that the Shell imports. A typo here is a runtime
   failure with a misleading error message.
4. **What is the display name?** What the Shell menu and the fallback view show.
5. **What sub-module name(s) does it cover?** Blank is a valid answer — a module
   may expose a single top-level page. If there are sub-modules, give the
   exposed path, e.g. `program/senarai-program`.
6. **What is the use case?** Why does this module exist, and who uses it? One
   line per point. This becomes `01-product/PRD.md`.
7. **Route prefix** the Shell will mount it under, e.g. `/v2t`.
8. **Role id** that grants access, e.g. `adminv2t`.
9. **Local port** for development (`shell` 3000, remotes from 3001 upward, `ui`
   `n/a`).
10. **Which backend API bases does it read?** List the `VUE_APP_URL_*` names the
    module's own source will reference, not the ones it inherits from the host.
11. **Where is the Shell repository?** Blank if this *is* the Shell.
12. **How does it depend on `@2enapps/ui`?** The git branch, a `file:` link, or
    `n/a`.
13. **Module slug** (a `module-pair` or `backend-api`). Lowercase, hyphenated —
    `module-demo`. It names the object-storage bucket (`module-demo`), the two
    repositories (`module_demo_fe` / `module_demo_be`), the Java package and the
    API base (`/api/module-demo`). It is derived everywhere else; asking once
    keeps the four of them from drifting apart.
14. **Backend port** — this module's own service, not the Shell's `3000`.

Then fill `.docs/project-governance/**` from the answers, replacing every
`{{TOKEN}}` you can. Do not leave a token that you have an answer for.

#### 1.2.1 After the governance tree, for a `module-pair`

The installer does this; do it by hand only when the installer is unavailable,
and in the same order:

1. **README table.** The routes table (`<!-- routes:start -->`) goes in
   `<slug>_fe/README.md`, the API table (`<!-- api:start -->`) in
   `<slug>_be/README.md`. Generated from `vue.config.js` exposes and from the
   Spring `@*Mapping` annotations — never from memory. At the Full level a third
   table, `<!-- workspace:start -->`, goes in the workspace `README.md` and
   records which repository is which.
2. **Scaffolding.** `<slug>_fe` and `<slug>_be` are written from the package's
   templates. Existing files are kept; `--force` backs up before replacing.
3. **Object storage.** Detect MinIO at `MINIO_ENDPOINT` (default
   `http://localhost:9000`). If it is absent, **ask the user before installing
   anything** — a non-interactive run prints the commands instead of acting —
   then create the bucket named after the slug. The bucket name is not typed
   twice: it comes from `--slug` or `--bucket` and the service reads the same
   value from its own `.env`.

**The user picks a level before each of those steps: 1 = Recommended,
2 = Economy, 3 = Full.** Report what the step will produce, then ask. A level
changes *scope*, never the rules:

| | Recommended | Economy | Full |
| --- | --- | --- | --- |
| 33 governance documents | yes | **yes — always** | yes |
| Scaffold | full | no test sources, no `.editorconfig` | + CI, CHANGELOG, pinned tool versions |
| README tables | per repository | none | + the workspace inventory |
| Object storage | detect, ask, create | untouched | create, then prove it is writable |
| Reporting | the counts | the counts | the counts, the answers, the decisions |

Economy never removes a document. A missing rule is not a lighter install; it is
a hole an agent reads as a fact. If the user wants less work, say so and let them
decide — do not quietly choose a smaller tree yourself.

### 1.3 Flow B — EXISTING module

The identity already exists in the repository. **Do not ask the user to retype
it** — read it, then confirm:

| Value | Source of truth | Never ask because |
| --- | --- | --- |
| remote name | `name:` in `ModuleFederationPlugin` / `remoteName` in `src/metadata.js` | a wrong answer breaks federation invisibly |
| exposed pages | `exposes:` in `vue.config.js` | each key is a contract with a Shell route |
| shared singletons | `shared:` in `vue.config.js` | a second Vue/Pinia instance is a runtime crash, not a lint error |
| `@2enapps/ui` version | `dependencies` in `package.json` | it changes which component APIs exist |
| API bases read | `VUE_APP_URL_*` in `.env.example` | the remote compiles separately from the Shell |
| role id | `meta.roles` in the Shell route table | it must equal the menu's `listRole` |
| route path | `path:` in the Shell route table | the menu's `capaianUrl` must equal it |

Present the extracted identity as a confirmation block and ask **only** what you
cannot read:

1. **What kind of work is this?** `new-feature` / `change-request` / `debug`.
2. **Which sub-module(s) does this work touch?**
3. **What is the use case / the defect?** One line per point. For `debug`:
   what is wrong, where, and since when.
4. **Which other repositories does this touch?** Anything whose compatibility
   you must then check in `07-delivery/SYNC.md`.

If the extracted identity contradicts the existing governance documents, that is
a finding. Report it and reconcile before writing code — do not silently
overwrite the documents.

### 1.4 Both flows: before any code

- Re-read `01-product/SCOPE.md`. If the task is not inside it, stop and open a
  Change Request instead. Work outside scope is a governance failure even when
  the code is correct.
- Read `06-quality/AUDIT.md` for the current state of the affected area.
- State the plan and get approval before implementing. No exceptions, including
  for "small" changes.

---

## Section 2 — The pipeline

Work moves through these stages in this order. Each stage has an entry document.
Skipping a stage is allowed only with a written reason in the current Change
Request.

**Every stage needs a human sign-off before the next one starts.** An agent
proposes; a person approves. "The tests pass" is not a sign-off, and neither is
the agent's own account of what it is about to do — the person approving has to
have seen the stage's output, or the artefact it is about to change. This is not
politeness: it is the only thing standing between a plausible guess and a
committed contract.

| # | Stage | Document | Produces |
| --- | --- | --- | --- |
| 1 | **PRD** | `01-product/PRD.md` | Why the product/module exists. No implementation. |
| 2 | **SCOPE** | `01-product/SCOPE.md` | What this repository owns, and what it does not |
| 3 | **AUDIT** | `06-quality/AUDIT.md` | What exists today, before development starts |
| 4 | **ARCHITECT** | `03-architecture/ARCHITECTURE.md` | The design, and an ADR if a decision is contested |
| 5 | **DEVELOP** | `05-development/DEVELOPMENT.md` | Code that matches the approved design exactly |
| 6 | **CHECK** | `06-quality/CHECK.md` | Architecture, standards, security, dependencies, quality |
| 7 | **TEST** | `06-quality/TESTING.md` | Unit → component → API → integration → contract → E2E → UAT |
| 8 | **DEBUG** | `06-quality/DEBUG.md` | Reproduction, hypothesis, fix, verification |
| 9 | **DOCUMENT** | `03-architecture/`, `04-design/` | Every document the change invalidated |
| 10 | **SYNC** | `07-delivery/SYNC.md` | Cross-repository version compatibility |
| 11 | **RELEASE** | `07-delivery/RELEASE.md` | A released, recorded, reversible version |

For a `change-request` or `debug` scope, the pipeline starts at step 3 with a
fresh entry in `01-product/CHANGE-REQUEST/` or `06-quality/DEBUG.md` — one file
per request, never a single overwritten file.

### 2.1 Sign-off: what a person actually has to do

A stage is signed off when a person has, in this order:

1. **Seen the output.** The artefact itself, not a summary of it. For ARCHITECT
   that is the design; for TEST that is the run, passing or failing.
2. **Answered three questions.** What changes for a user? What breaks if this is
   wrong? What was deliberately left out?
3. **Said yes** — a reply, a review approval, a line in the Change Request.
   Silence is not a yes, and a green pipeline is not either: `mvn verify` passing
   means the code compiles, not that it should exist.

Record who approved and when, in the Change Request or in the ADR for any
contested decision. An unrecorded approval cannot be audited, and one nobody can
find is indistinguishable from one that never happened.

Two things an agent may **not** do here, whatever the pressure:

- **Self-approve.** If the agent that produced the artefact also signs it off,
  the gate is a formality and every rule in this file becomes advisory. Say
  "waiting for sign-off" and stop.
- **Split the work to get under the gate.** One request that touches two stages
  is two sign-offs, not one — and it is exactly the change nobody looked at
  closely that the gate exists to catch.

A smaller job is not a smaller gate. "Just add the flag" is still a stage, and it
still needs a person to say yes before the next one starts.

---

## Section 3 — Routing table

Read the document that answers your question. Nothing else.

### "What is this for / who uses it?"

- `01-product/PRD.md`
- `01-product/SCOPE.md`

### "Am I allowed to do this?"

- `02-governance/GUARDRAILS.md` — hard prohibitions
- `01-product/SCOPE.md` — ownership boundaries

### "How must the code look?"

- `02-governance/STANDARDS.md` — naming, structure, language rules
- `02-governance/ANTI-SLOP.md` — what this repository refuses to accept, and why
- `05-development/FORMAT-LINT.md` — the formatters, the linters, the gate command
- `04-design/UI-STANDARD.md` — presentation rules
- `04-design/TEMPLATE.md` — copy-paste patterns for common cases

### "What does done mean?"

- `02-governance/QUALITY.md`
- `06-quality/CHECK.md`

### "How does this fit with the Shell / other modules / the backend?"

- `03-architecture/ARCHITECTURE.md` — the ecosystem rules
- `03-architecture/INTEGRATION.md` — how a module is registered end to end
- `03-architecture/API-CONTRACT.md` — the frontend/backend boundary
- `03-architecture/AUTHENTICATION.md` — session, roles, where authorization is enforced

### "Why is it built this way?"

- `03-architecture/ADR.md`

### "What can I use?"

- `05-development/TOOLS.md` — the approved stack
- `05-development/FORMAT-LINT.md` — how the approved stack is enforced
- `05-development/REPOSITORY-STANDARD.md` — required files, branches, commits

### "How is the backend shaped / where do uploads go?"

- `09-backend/SPRING-BOOT.md` — layers, object model, the Spring idioms in use
- `09-backend/STORAGE.md` — MinIO, one bucket per module, the upload endpoints

### "How do I verify it?"

- `06-quality/CHECK.md` — static verification, before running anything
- `06-quality/TESTING.md` — the layered test plan, whitebox and blackbox
- `06-quality/AUDIT.md` — the pre-development state record

### "Something is broken."

- `06-quality/DEBUG.md`
- `08-operations/RUNBOOK.md` — the diagnostic decision tree
- `08-operations/INCIDENT.md` — when it is a production incident

### "How does it ship?"

- `07-delivery/DEPLOYMENT.md`
- `07-delivery/VERSIONING.md`
- `07-delivery/SYNC.md`
- `07-delivery/RELEASE.md`

### "It is running but something is wrong."

- `08-operations/MONITORING.md`
- `08-operations/INCIDENT.md`
- `08-operations/RUNBOOK.md`

---

## Section 4 — The rules that fit in this file

The full rules are in the documents. These are the ones that must never be
violated, restated here because they are cheap to check and expensive to get
wrong. `02-governance/GUARDRAILS.md` is authoritative and complete.

1. **Never create a second Keycloak client.** Authentication is initialised once,
   in the Shell. A remote gets credentials through the host adapter. No client
   secret ever appears in a frontend repository.
2. **Never bundle a second copy of a shared singleton.** `vue`, `vue-router`,
   `pinia` and `vue-i18n` must resolve to the Shell's instance. A remote that
   bundles its own Pinia produces `getActivePinia() was called but there was no
   active Pinia`, or a store the Shell never writes to.
3. **Never put a feature page in the Shell, or Shell logic in a remote.** The
   Shell owns bootstrap, auth, navigation, routing and the host entry. A remote
   owns feature views, feature services and its own preview entry.
4. **Never treat the Shell's route guard as the security boundary.** It is
   navigation defence in depth. Every backend endpoint validates the token and
   the role independently.
5. **Never invent an API.** If it is not in `03-architecture/API-CONTRACT.md`,
   you do not know its shape. Ask, then write the contract, then call it.
6. **Never hardcode a URL, port, bucket or role in source.** Every value comes
   from the module's own environment, compiled into that module.
7. **Never silently upgrade a major version of a shared package.** Follow
   `07-delivery/SYNC.md`.
8. **Never claim a result you did not observe.** Run the command, read the
   output, quote it. "Should work" is not evidence.
9. **Never leave a placeholder you could have filled**, and never invent an
   answer to fill one with. Fill it or say it is open.
10. **Never skip `CHECK` before `TEST`.** A test that runs against code failing a
    standard is a test of the wrong thing.

---

## Section 5 — Reporting

Every task ends with a report in this shape:

```
Task        <what was asked>
Detected    <new repository | shell | remote-module | shared-ui | backend-api>
Scope       <new-feature | change-request | debug>
Touched     <files changed, grouped by repository>
Verified    <exact command → exact observed result>
Open        <anything unresolved, each with the document that must record it>
```

`Verified` must contain commands you actually ran and their actual output. If a
step could not be run, say so under `Open`. Do not summarise a passing check
into "verified" when you only read the code.

---

## Governance index

| Section | Document | Purpose |
| --- | --- | --- |
| 01 | [`README.md`](.docs/project-governance/README.md) | How to use this tree |
| 01 | [`PRD.md`](.docs/project-governance/01-product/PRD.md) | Why this exists |
| 01 | [`SCOPE.md`](.docs/project-governance/01-product/SCOPE.md) | What this repository owns |
| 01 | [`CHANGE-REQUEST.md`](.docs/project-governance/01-product/CHANGE-REQUEST.md) | How a CR is written |
| 02 | [`STANDARDS.md`](.docs/project-governance/02-governance/STANDARDS.md) | How code must look |
| 02 | [`GUARDRAILS.md`](.docs/project-governance/02-governance/GUARDRAILS.md) | What must never happen |
| 02 | [`QUALITY.md`](.docs/project-governance/02-governance/QUALITY.md) | Definition of done |
| 02 | [`ANTI-SLOP.md`](.docs/project-governance/02-governance/ANTI-SLOP.md) | What is refused, and why |
| 02 | [`SECURITY.md`](.docs/project-governance/02-governance/SECURITY.md) | Security rules |
| 03 | [`ARCHITECTURE.md`](.docs/project-governance/03-architecture/ARCHITECTURE.md) | Ecosystem rules |
| 03 | [`API-CONTRACT.md`](.docs/project-governance/03-architecture/API-CONTRACT.md) | Frontend/backend boundary |
| 03 | [`INTEGRATION.md`](.docs/project-governance/03-architecture/INTEGRATION.md) | Registering a module |
| 03 | [`AUTHENTICATION.md`](.docs/project-governance/03-architecture/AUTHENTICATION.md) | Session and roles |
| 03 | [`ADR.md`](.docs/project-governance/03-architecture/ADR.md) | Decision records |
| 04 | [`DESIGN.md`](.docs/project-governance/04-design/DESIGN.md) | UX/UI architecture |
| 04 | [`UI-STANDARD.md`](.docs/project-governance/04-design/UI-STANDARD.md) | Presentation rules |
| 04 | [`TEMPLATE.md`](.docs/project-governance/04-design/TEMPLATE.md) | Reusable patterns |
| 05 | [`DEVELOPMENT.md`](.docs/project-governance/05-development/DEVELOPMENT.md) | How to build |
| 05 | [`FORMAT-LINT.md`](.docs/project-governance/05-development/FORMAT-LINT.md) | Formatters, linters, the gate |
| 05 | [`TOOLS.md`](.docs/project-governance/05-development/TOOLS.md) | Approved stack |
| 05 | [`REPOSITORY-STANDARD.md`](.docs/project-governance/05-development/REPOSITORY-STANDARD.md) | Repository shape |
| 06 | [`AUDIT.md`](.docs/project-governance/06-quality/AUDIT.md) | Pre-development state |
| 06 | [`CHECK.md`](.docs/project-governance/06-quality/CHECK.md) | Pre-test verification |
| 06 | [`TESTING.md`](.docs/project-governance/06-quality/TESTING.md) | Layered testing |
| 06 | [`DEBUG.md`](.docs/project-governance/06-quality/DEBUG.md) | Troubleshooting |
| 07 | [`DEPLOYMENT.md`](.docs/project-governance/07-delivery/DEPLOYMENT.md) | Environments and pipelines |
| 07 | [`VERSIONING.md`](.docs/project-governance/07-delivery/VERSIONING.md) | Version scheme |
| 07 | [`SYNC.md`](.docs/project-governance/07-delivery/SYNC.md) | Cross-repository compatibility |
| 07 | [`RELEASE.md`](.docs/project-governance/07-delivery/RELEASE.md) | Release procedure |
| 08 | [`MONITORING.md`](.docs/project-governance/08-operations/MONITORING.md) | What is watched |
| 08 | [`INCIDENT.md`](.docs/project-governance/08-operations/INCIDENT.md) | Incident response |
| 08 | [`RUNBOOK.md`](.docs/project-governance/08-operations/RUNBOOK.md) | Operational procedures |
| 09 | [`SPRING-BOOT.md`](.docs/project-governance/09-backend/SPRING-BOOT.md) | Backend layering and Spring |
| 09 | [`STORAGE.md`](.docs/project-governance/09-backend/STORAGE.md) | MinIO and uploads |

---

**Do not edit this file's rules.** Add a document, or change one, and update the
tables above in the same commit.
