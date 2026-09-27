<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# Project Governance — {{REPO_NAME}}

The governance tree for **{{MODULE_DISPLAY}}** (`{{MODULE_NAME}}`), the
`{{MODULE_KIND}}` repository of the D-ReAMS platform.

Owner: {{OWNER}} · Module version {{MODULE_VERSION}} · API contract v{{API_VERSION}}

> Read this file first. Everything below it is a decision somebody already made,
> or a place to record one.

---

## 1. What this tree is for

Work in a micro-frontend platform moves across repositories that are built,
tested and deployed independently. Shell, a frontend module, the shared UI
package and a backend API can all be at different versions at the same moment.
Without a written record of who owns what, the same decision gets made twice in
two repositories and the two versions disagree.

This tree is that record. It has one job: **make the current state of a decision
findable by the next person, or the next agent, without reading the code.**

It is not a wiki. It is not a status dashboard. Documents are edited when the
thing they describe changes, in the same commit as the change.

---

## 2. The layout

```
project-governance/
│
├── README.md                 you are here
│
├── 01-product/               WHY — the problem, the value, the boundary
│   ├── PRD.md                why this module exists
│   ├── SCOPE.md              what this repository owns, and what it does not
│   └── CHANGE-REQUEST.md     one file per CR, never overwritten
│
├── 02-governance/            RULES — binding on humans and agents alike
│   ├── STANDARDS.md          how code must look
│   ├── GUARDRAILS.md         what must never happen
│   ├── QUALITY.md            what "done" means
│   ├── ANTI-SLOP.md          what this repository refuses to accept
│   └── SECURITY.md           the security rules and their rationale
│
├── 03-architecture/          STRUCTURE — how the pieces fit
│   ├── ARCHITECTURE.md       the rules of the whole ecosystem
│   ├── API-CONTRACT.md       the frontend ↔ backend boundary
│   ├── INTEGRATION.md        registering a module end to end
│   ├── AUTHENTICATION.md     session, roles, where authorization is enforced
│   └── ADR.md                one record per contested decision
│
├── 04-design/                SHAPE — how it looks and behaves
│   ├── DESIGN.md             UX/UI architecture, not colours
│   ├── UI-STANDARD.md        the presentation rules
│   └── TEMPLATE.md           copy-paste patterns for common cases
│
├── 05-development/           CRAFT — how the code gets written
│   ├── DEVELOPMENT.md        the build loop
│   ├── FORMAT-LINT.md        formatters, linters, and the gate command
│   ├── TOOLS.md              the approved stack, and what is not
│   └── REPOSITORY-STANDARD.md required files, branches, commits
│
├── 06-quality/               PROOF — how we know it is right
│   ├── AUDIT.md              what exists today, before development starts
│   ├── CHECK.md              static verification, before running anything
│   ├── TESTING.md            the layered test plan
│   └── DEBUG.md              reproduce, hypothesise, fix
│
├── 07-delivery/              SHIP — how it reaches users
│   ├── DEPLOYMENT.md         environments and pipelines
│   ├── VERSIONING.md         the version scheme
│   ├── SYNC.md               cross-repository compatibility
│   └── RELEASE.md            the release procedure
│
├── 08-operations/            SUSTAIN — how it stays healthy
│   ├── MONITORING.md         what is watched, and the alert thresholds
│   ├── INCIDENT.md           incident roles and procedure
│   └── RUNBOOK.md            operational procedures and decision trees
│
└── 09-backend/               SERVICE — the module's own API (backend installs)
    ├── SPRING-BOOT.md        layering, object model, Spring idioms
    └── STORAGE.md            object storage: MinIO, one bucket per module
```

---

## 3. The pipeline

Work moves through these stages in this order. Each stage reads one document and
writes back to it.

```
        PRD                                    01-product/PRD.md
         ↓  why does this exist, and for whom
       SCOPE                                  01-product/SCOPE.md
         ↓  what does this repository own
       AUDIT                                  06-quality/AUDIT.md
         ↓  what exists today, before we touch it
     ARCHITECT                                03-architecture/ARCHITECTURE.md
         ↓  the design; an ADR if a decision is contested
      DEVELOP                                 05-development/DEVELOPMENT.md
         ↓  only the approved design
       CHECK                                  06-quality/CHECK.md
         ↓  architecture · standards · security · dependencies · quality
       TEST                                   06-quality/TESTING.md
         ↓  unit → component → API → integration → contract → E2E → UAT
      DEBUG                                   06-quality/DEBUG.md
         ↓  reproduce, hypothesise, fix, verify
     DOCUMENT                     03-architecture/ · 04-design/
         ↓  every document the change invalidated
       SYNC                                   07-delivery/SYNC.md
         ↓  align versions across repositories
     RELEASE                                  07-delivery/RELEASE.md
```

### Starting points by scope

| Scope | Where the pipeline starts | What you open |
| --- | --- | --- |
| `new-feature` | PRD | `01-product/PRD.md` |
| `change-request` | AUDIT | a new file in `01-product/CHANGE-REQUEST/` |
| `debug` | AUDIT | `06-quality/DEBUG.md` |

The same pipeline serves a change request. Only the starting document changes.

### The two rules that make the pipeline real

1. **You may not skip forward.** `CHECK` runs before `TEST`. A test written
   against code that violates a standard is a test of the wrong thing, and it
   will be deleted later without ceremony.
2. **A stage you skipped is a stage you justify in writing**, in the current
   Change Request, with a reason. "Not applicable" is only true if you can say
   what it would have contained.

---

## 4. How to use this tree

### For a human

Read `SCOPE.md` before you touch anything. It is the shortest document here and
the one that saves the most time.

### For an AI agent

Start at the repository root `AGENTS.md`. It detects whether this is a new
repository or an existing module, runs the matching intake, and routes every
question to a document in this tree. Do not work from the code alone: the code
shows what *is*, these documents record what *should be*, and the difference
between the two is the work.

### Working agreement

- A document is edited **in the same commit** as the change that invalidates it.
- If a document is wrong, fix it first or in the same commit. Do not let a known
  wrong document sit in the tree "for now" — the next agent will trust it.
- Never delete a document. Supersede it, and say so at the top.
- One decision, one file. `ADR.md` holds one record per decision, in order.
  `CHANGE-REQUEST/` holds one file per request, in order.
- Leave a `{{TOKEN}}` visible rather than guessing. A visible placeholder is
  greppable; a plausible invention is not.

---

## 5. Platform reference

The ecosystem this repository is part of.

```
Users
   |
   v
+---------------------------+
|        SHELL / HOST       |   @2enapps/shell
| Auth / SSO / Navigation   |   owns: bootstrap, Keycloak, router,
| Shared UI / Routing       |         shared singletons, host entry
+-------------+-------------+
              |
      +-------+--------+----------------+
      |                |                |
      v                v                v
+-----------+    +-----------+    +-----------+
| {{MODULE_DISPLAY}}  | Module B      | Module C      |   independently deployed
| {{MODULE_NAME}}     |               |               |   frontend modules
+-----+-----+    +-----+-----+    +-----+-----+
      |                |                |
      v                v                v
+-----------+    +-----------+    +-----------+
| API A     |    | API B     |    | API C     |   separately deployed
| Backend   |    | Backend   |    | Backend   |   backend services
+-----------+    +-----------+    +-----------+
```

`{{MODULE_NAME}}` is hosted at `{{ROUTE_PREFIX}}`, grants access via role
`{{ROLE_KEY}}`, reads {{API_BASES_LIST}} , and depends on the shared UI package
as `{{UI_DEPENDENCY}}`.

The Shell repository lives at `{{SHELL_REPO}}`. Local development port for this
repository: `{{REMOTE_PORT}}`.

---

## 6. Document owners

| Section | Who may change it | Who must be consulted |
| --- | --- | --- |
| `01-product/` | {{OWNER}} | the requester |
| `02-governance/` | {{OWNER}} | anyone, by Change Request |
| `03-architecture/` | {{OWNER}} | the Shell owner for anything cross-repository |
| `04-design/` | {{OWNER}} | — |
| `05-development/` | {{OWNER}} | — |
| `06-quality/` | {{OWNER}} | — |
| `07-delivery/` | {{OWNER}} | the Shell owner, for `SYNC.md` |
| `08-operations/` | {{OWNER}} | whoever is on call |
| `09-backend/` | {{OWNER}} | — |

---

## 7. Open placeholders

Run this to find what still needs an answer:

```sh
grep -rn '{{[A-Z_]*}}' .docs/project-governance/
```

Replace every hit with a real value, or delete the sentence. Do not leave a
document that reads as finished while still containing a placeholder — that is
worse than an obviously incomplete document, because it will be trusted.
