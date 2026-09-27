<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# QUALITY — {{MODULE_NAME}}

What "done" means in this repository.

"Done" is a claim, so it needs a definition that can be checked. This document
is that definition. `06-quality/CHECK.md` is the mechanical half;
`06-quality/TESTING.md` is the behavioural half. Both must pass.

---

## 1. The definition of done

A change is done when **all** of the following are true. Not most. All.

| # | Criterion | Verified by |
| --- | --- | --- |
| D1 | It is inside `01-product/SCOPE.md`, or a Change Request was approved | §3 of the CR |
| D2 | `AUDIT` was run before development and its findings recorded | `06-quality/AUDIT.md` |
| D3 | `CHECK` passes: architecture, standards, security, dependencies, quality | `06-quality/CHECK.md` |
| D4 | Tests pass at every layer the change touches | `06-quality/TESTING.md` |
| D5 | A browser was actually opened and the change exercised — blackbox | Playwright run, pasted |
| D6 | The failure case was tested, not just the success case | Negative test, pasted |
| D7 | Every user-visible string is in all six locales | Locale check |
| D8 | Every touched document was updated **in the same commit** | `git show --stat` |
| D9 | `07-delivery/SYNC.md` was checked for cross-repository impact | §10 of the CR |
| D10 | The change is reversible, and the reversal is known | Rollback note |
| D11 | The report quotes real command output | The final report |

---

## 2. Why each criterion exists

| # | The failure it prevents |
| --- | --- |
| D1 | Work accumulates in the wrong repository until it is nobody's |
| D2 | A fix built on a wrong model of the current code |
| D3 | A passing test suite over code that violates the architecture |
| D4 | Regression in a path nobody looked at |
| D5 | "It works" asserted from reading code, while the page 404s in a browser |
| D6 | A fix that only handles the happy path |
| D7 | A user in `ar` sees an English key where a label should be |
| D8 | The next person reads a document that describes the old behaviour |
| D9 | The Shell deploys a version of this module that was never tested together |
| D10 | A rollback that turns a bad afternoon into an outage |
| D11 | A false claim of completion, which is worse than an unfinished task |

---

## 3. Quality attributes, in priority order

When two attributes conflict, the higher one wins. This ordering is deliberate.

1. **Security and authorization** — a defect here is a data breach. See
   `02-governance/SECURITY.md`.
2. **Correctness** — does it do the specified thing, including when the input is
   wrong?
3. **Contract integrity** — federation keys, API shapes, role ids, version ranges.
   See `02-governance/GUARDRAILS.md` §4.
4. **Accessibility** — a feature nobody but a mouse user can reach is broken.
5. **Performance** — a page that takes 8s to list is unusable; measure before
   optimising.
6. **Maintainability** — matters, but never at the cost of 1–5.
7. **Consistency with surrounding code** — lowest, because it is the one that
   makes a broken thing look correct.

---

## 4. Review standards

### Blockers — must be fixed before merge

- A `GUARDRAILS.md` violation.
- A test failure, or a test deleted instead of fixed.
- A skipped test with no reason and no ticket.
- A security or authorization defect.
- An undocumented new environment variable, endpoint, or exposed page.
- A breaking contract change without a version bump and a `SYNC.md` entry.

### Must fix, not blocking

- A duplicated helper.
- A missing translation key.
- A `console.warn` on a path that is not actually degraded.
- A comment that restates the code.

### Acceptable, but say so

- A `@2enapps/ui` component that does not quite fit, with a reason it was not
  changed in the shared package.
- A deliberate deviation from `02-governance/STANDARDS.md`, recorded in the CR.

### Not review material

- Formatting a tool already enforces. Do not comment on it.
- A personal preference for a naming style the repository does not use.

---

## 5. Evidence

> **A quality claim without a command is an opinion.**

Acceptable:

```
$ npx -y @lqmnwido/dreams-ai-skills-check
  ✓ 30/30 governance documents present
  ✓ documented identity matches the repository

$ npm run test:e2e -- --grep "program list"
  3 passed (12.4s)
```

Not acceptable:

- "All checks pass."
- "The tests are fine."
- "Should work now."
- "Verified manually." — with no description of what was clicked, and no
  screenshot or run id.

If a step could not be run, say so explicitly and say why. An honest gap is
actionable; a fabricated pass is not.

---

## 6. When quality is allowed to be traded

Only for an incident that is actively causing harm, and only with:

1. A named approver.
2. A written list of what was skipped, from `06-quality/CHECK.md` and
   `06-quality/TESTING.md`.
3. An issue that will close the gap, with a date.
4. A record in `08-operations/INCIDENT.md`.

A deadline is not an incident. Neither is a demo.

---

## 7. Definition of done — sign-off

| Criterion | Met? | Evidence |
| --- | --- | --- |
| D1 In scope / CR approved | | |
| D2 Audit recorded | | |
| D3 Check passes | | |
| D4 Tests pass | | |
| D5 Browser exercised | | |
| D6 Failure case tested | | |
| D7 Locales complete | | |
| D8 Documents updated | | |
| D9 Sync checked | | |
| D10 Reversible | | |
| D11 Evidence quoted | | |
