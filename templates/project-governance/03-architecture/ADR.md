<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# ADR — Architecture Decision Records

One record per decision. Numbered, append-only, never rewritten.

An ADR answers a question that will be asked again — usually by someone who
disagrees with the answer, which is exactly when you want the reasoning to
exist.

---

## 1. When to write one

Write an ADR when:

- Two competent engineers would reasonably choose differently.
- The decision constrains a future option irreversibly for more than one release.
- It affects more than one repository.
- It departs from `02-governance/STANDARDS.md` or
  `02-governance/GUARDRAILS.md`.
- Someone will otherwise ask "why is it done like this?" in six months.

**Do not** write an ADR for an obvious choice, a bug fix, or a change with one
reasonable implementation. The record must be worth reading.

Write it **when the decision is made**, not afterwards from memory. The
alternatives you genuinely considered are the valuable part, and they are the
part memory loses.

---

## 2. Format

```markdown
# ADR-NNN — <title>

| Field | Value |
| --- | --- |
| Status | proposed \| accepted \| superseded by ADR-NNN \| deprecated \| rejected |
| Date | |
| Deciders | |
| Affected repositories | {{REPO_NAME}}, {{BLAST_RADIUS}} |
| Supersedes | ADR-NNN |

## Context

What is true today that forces a decision. Facts and constraints, not opinions.
Include the failure that prompted it, with evidence.

## Options considered

### Option A — <name>

How it works. Effort. Risk. What it costs later.

### Option B — <name>

How it works. Effort. Risk. What it costs later.

### Option C — do nothing

What happens if we change nothing. This option is real and is often the answer.

## Decision

Which option, stated in one sentence.

## Rationale

Why this option over the others. This is the section that is read in two years,
so it must contain the reasoning, not the conclusion.

## Consequences

**Accepted costs**

- 

**Gained**

- 

**Follow-on work**

- 

## Revisit when

The observable condition that would make this decision wrong. Without this line,
an ADR is a decree rather than a decision.
```

---

## 3. Record lifecycle

| Status | Meaning |
| --- | --- |
| `proposed` | Written, not decided. The decision is still open. |
| `accepted` | In force. The code follows it. |
| `superseded by ADR-NNN` | Replaced. The old record stays, with this status. |
| `deprecated` | No longer relevant, but the code still exists. |
| `rejected` | Considered and declined. Kept so it is not re-proposed. |

**A record is never deleted and never edited after it is `accepted`.** To change
a decision, write a new ADR that supersedes it, and set the old one's status.
This is the entire point: the history of the reasoning is the artefact.

---

## 4. Index

| ADR | Title | Status | Date | Affects |
| --- | --- | --- | --- | --- |
| | | | | |

<!-- add a row when you write a record -->

---

## 5. Platform decisions already in force

Decisions that apply across every module. Sourced from
`03-architecture/ARCHITECTURE.md`; this module inherits them without a local ADR.

| # | Decision | Consequence for `{{MODULE_NAME}}` |
| --- | --- | --- |
| P1 | The Shell is the only federation host | This module exposes pages; it never composes other remotes |
| P2 | Keycloak is initialised once, in the Shell | This module reads credentials through the host adapter |
| P3 | `vue`, `vue-router`, `pinia`, `vue-i18n` are Shell-owned singletons | This module must not bundle its own |
| P4 | The Shell owns the eager share-scope entries | This module declares `singleton` without `eager` |
| P5 | Shared presentation lives in `@2enapps/ui` | This module consumes it; it does not fork a component |
| P6 | Authorization is the backend's job | The route guard is defence in depth only |
| P7 | Expose keys and route paths are versioned contracts | Renaming one is a major version bump |
| P8 | Each compiled app owns its own environment | An API base read here is declared here |
| P9 | The Shell owns remote resilience | This module does not implement its own fallback |
| P10 | `VUE_APP_SKIP_ROLE_CHECK` is local-only | Never present in a deployed environment |

Change any of these and the change is cross-repository by definition. It needs
an ADR, a `07-delivery/SYNC.md` entry, and agreement from the owners of the other
repositories.

---

## 6. Template

Copy the block in §2 into a new record at the end of this file, then add a row to
the index in §4.
