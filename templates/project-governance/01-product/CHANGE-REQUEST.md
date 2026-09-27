<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# Change Requests — {{MODULE_NAME}}

A Change Request (CR) is how work that already has a home gets a new or changed
shape. It is **one file per request**, filed in `CHANGE-REQUEST/`, numbered
sequentially and never overwritten.

> **One file per CR.** A single `CHANGES.md` that is edited in place loses the
> history, which is the only reason a CR exists. When a reader asks "why is it
> like this", the answer is a file with a number, a date, and a reason.

---

## 1. The CR pipeline

A CR runs the same pipeline as a new feature, from a different starting point.

```
   CR filed  ──▶  SCOPE  ──▶  AUDIT  ──▶  ARCHITECT  ──▶  DEVELOP
                                                            │
        RELEASE  ◀──  SYNC  ◀──  DOCUMENT  ◀──  DEBUG  ◀──  CHECK  ◀──  TEST
```

| Stage | Question it answers | Where it is recorded |
| --- | --- | --- |
| SCOPE | Is this inside this repository? | §3 of the CR, cross-checked against `SCOPE.md` |
| AUDIT | What exists today? | §4 of the CR, or a new `06-quality/AUDIT.md` entry |
| ARCHITECT | What changes, and what is the alternative? | §5, plus an ADR if the decision is contested |
| DEVELOP | What was actually built? | the diff |
| CHECK | Does it satisfy the rules? | §6, the `CHECK` output |
| TEST | Does it behave as specified? | §7, the `TEST` output |
| DEBUG | What went wrong on the way? | §8, or a `06-quality/DEBUG.md` entry |
| DOCUMENT | Which documents did this invalidate? | §9, the list |
| SYNC | Which other repositories must move? | §10, plus `07-delivery/SYNC.md` |
| RELEASE | What shipped, and can it be rolled back? | §11 |

---

## 2. Filing a CR

1. Copy the template below into `CHANGE-REQUEST/CR-NNN-short-title.md`, where
   `NNN` is the next unused number and the title is three or four words in
   kebab-case.
2. Fill §1–§5. **Stop there and get approval.** No code before the design is
   approved.
3. Implement §6–§8 as you go, filling each section with the real command output
   as it is produced, not afterwards from memory.
4. §9–§11 are completed before merge.

Numbering is per repository. `CR-001` in `{{MODULE_NAME}}` and `CR-001` in the
Shell are different requests.

---

## 3. CR template

Copy everything between the rules into a new file.

---

<!-- CR-NNN-short-title.md -->

```markdown
# CR-NNN — <title>

| Field | Value |
| --- | --- |
| Repository | {{REPO_NAME}} |
| Raised by | |
| Date | |
| Scope | new-feature \| change-request \| debug |
| Status | draft \| approved \| in-progress \| in-review \| released \| rejected \| superseded |
| Affects other repositories | {{BLAST_RADIUS}} |
| Rollback | revert the commit \| revert and redeploy \| data migration required |

## 1. Summary

Three sentences. What changes, for whom, and what happens if we do nothing.

## 2. Motivation

The problem, and the evidence it is real. Link the user, the ticket, the
incident in `08-operations/INCIDENT.md`, or the request in
`01-product/PRD.md` §4. A CR with no motivation is a preference.

## 3. Scope

**In scope** — from `01-product/SCOPE.md`:

- 

**Out of scope** — explicitly, so it is not re-argued later:

- 

**Cross-repository?** If any of these are true, this is not a single-repository
change and §10 is mandatory:

- [ ] a new exposed page path
- [ ] a changed `shared` singleton configuration
- [ ] a `@2enapps/ui` version range change
- [ ] a new or changed API endpoint
- [ ] a new or changed role or menu entry
- [ ] a new environment variable read at compile time

## 4. Audit — what exists today

| Path | Current behaviour | Problem |
| --- | --- | --- |
| | | |

Reproduce the problem before describing it. A CR that says "the export is slow"
without a measurement will be sent back for one.

## 5. Design

**Option A — <name>**

- How it works
- Effort
- Risk
- What it costs later

**Option B — <name>**

- How it works
- Effort
- Risk
- What it costs later

**Recommendation:** A, because <reason>.

A contested decision — two engineers who would reasonably choose differently —
gets an ADR in `03-architecture/ADR.md`. The ADR is written at the moment the
decision is made, not afterwards from memory.

**Contracts affected:**

- API: <endpoint, or "none">
- Federation: <expose key, or "none">
- Shared package: <component/prop, or "none">

## 6. Check

Command → observed result. Paste the output, do not summarise it.

| Check | Command | Result |
| --- | --- | --- |
| Architecture | `npx -y @lqmnwido/dreams-ai-skills-check` | |
| Standards | | |
| Security | | |
| Dependencies | | |
| Code quality | | |

## 7. Test

| Layer | What it covers | Where | Result |
| --- | --- | --- | --- |
| Unit | | | |
| Component | | | |
| API | | | |
| Integration | | | |
| Contract | | | |
| E2E (blackbox, browser) | | | |
| UAT | | | |

## 8. Debug log

Any defect hit during the work, the reproduction, the cause, the fix. If there
was none, write "none" — an empty section reads as "not recorded".

## 9. Documents updated

- [ ] `01-product/SCOPE.md` — ownership changed
- [ ] `01-product/PRD.md` — capability added or changed
- [ ] `03-architecture/ARCHITECTURE.md`
- [ ] `03-architecture/API-CONTRACT.md`
- [ ] `03-architecture/INTEGRATION.md`
- [ ] `03-architecture/AUTHENTICATION.md`
- [ ] `04-design/DESIGN.md`
- [ ] `05-development/TOOLS.md`
- [ ] `07-delivery/SYNC.md`
- [ ] `07-delivery/VERSIONING.md`
- [ ] `08-operations/RUNBOOK.md`

## 10. Sync plan

| Repository | Must move to | Compatible with current? | Action |
| --- | --- | --- | --- |
| Shell | | | |
| `@2enapps/ui` | | | |
| {{BLAST_RADIUS}} | | | |

## 11. Release

- Version: `{{MODULE_VERSION}}` →
- Released: {{REVIEW_DATE}}
- Rollback tested: yes / no — <how>
- `07-delivery/SYNC.md` updated: yes / no
```

<!-- end of CR template -->

---

## 4. CR rules

1. **No code before approval.** A CR in `draft` may contain design. It may not
   contain an implementation.
2. **One request per file.** Two unrelated changes in one CR cannot be reviewed,
   and cannot be rolled back independently.
3. **A CR that changes the scope boundary** must update `01-product/SCOPE.md` in
   the same commit. If the change is not yours to make, that is the answer.
4. **A CR that adds a dependency** updates `05-development/TOOLS.md` first. If
   the tool is not in the approved list, the CR is about approving the tool, and
   it should say so.
5. **A CR that changes an exposed page path is a major version bump.** See
   `07-delivery/VERSIONING.md`. The Shell import string and the remote expose key
   must change together, or the Shell route renders its fallback.
6. **Rejections are kept.** A rejected CR is a decision somebody will ask about
   again. Record it and close it.

---

## 5. Index

| CR | Title | Status | Date | Released in |
| --- | --- | --- | --- | --- |
| | | | | |

<!-- add a row here when you file a CR -->
