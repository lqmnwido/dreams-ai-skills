<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# ANTI-SLOP — {{MODULE_NAME}}

What this repository refuses to accept, and why.

"Slop" is code that looks finished and is not: the confident draft, the
plausible structure, the sentence that describes an intention instead of a
behaviour. It is not a style problem and it is not about who wrote it — the
particular failure mode of generating code quickly is that *nothing argues with
it*, and this document is the argument.

Every rule below is either (a) something a reviewer can spot in seconds, or
(b) something that has already cost this platform a real defect. Nothing here is
taste.

---

## 1. The rules

### 1.1 Never write what you have not verified

| Forbidden | Why |
| --- | --- |
| "This should work" as a commit message or PR description | An expectation is not a result. State what you ran and what it printed |
| A test name that describes intent rather than the assertion | `handlesErrors` proves nothing; `uploadRejectsAnEmptyFile` is falsifiable |
| Claiming a fix without the command that demonstrates it | The reviewer cannot repeat what you did not run |
| Inventing an API, a field, an endpoint or a config key | If it is not in the code or in `03-architecture/API-CONTRACT.md`, it does not exist |

If you cannot verify it, say so in plain words: *"not run — no MinIO locally"*.
An honest gap is a fact a reviewer can act on. A confident guess is not.

### 1.2 No dead or speculative code

- **Commented-out code.** Delete it; git is the history.
- **`TODO` with no `01-product/CHANGE-REQUEST.md` id.** Either it is worth a
  change request or it is not worth a line.
- **A class written for a future caller.** One implementation does not need an
  interface, a factory or a strategy. Add the abstraction in the commit that
  needs it — the second implementer is what justifies the first one.
- **An unused export, an unreachable branch, a parameter nobody passes.**
  Linters find most of this; the ones they cannot find are the ones someone
  added "for completeness".

### 1.3 No comments that restate the code

```js
// Bad
// set the count to zero
count = 0;

// Good — why, not what
// Reset the running total before the second pass; it is cumulative.
count = 0;
```

A comment that adds nothing is not neutral: it makes the next reader skip all
the comments, including the ones carrying a decision.

### 1.4 One job per function, one reason per class

- A name containing `and`, `or`, `handle`, `doStuff`, `process` or `manage` is
  a symptom, not a name.
- A method longer than the screen it is read on is doing more than one thing.
- A class that reaches for three collaborators in its constructor is three
  classes.
- Nesting deeper than three levels is a control-flow problem. Guard clauses
  first, loops second, no `else` after `return`.

### 1.5 No dumping grounds

`utils`, `helpers`, `common`, `misc`, `base`, `manager`, `impl`. A file that can
hold anything eventually holds everything, and no search ever finds the right
thing again. Name the file after the concept it owns:
`DocumentService`, `StorageProperties`, `objectKey`.

### 1.6 No silent failure

- `catch (e) { return null; }` turns an outage into an empty screen.
- Swallowing an exception without a log line destroys the only evidence.
- Returning a fallback value for a *failed* operation is not resilience; it is
  a slower way to discover the failure.

Translate an exception where it crosses a boundary — and nowhere else. See
`09-backend/SPRING-BOOT.md` §5 for where that boundary is on the backend.

### 1.7 No unrequested work

- No refactor in a bug fix; no formatting churn in a refactor.
- No new dependency where a language built-in exists (`Intl`, `fetch`,
  `Object.entries`, `Optional`).
- No configuration file for a value that never changes.
- No abstraction, indirection or layer the ticket did not ask for.

Unrequested work is not generosity. It is diff a reviewer must now understand,
in a file the change did not need to touch.

### 1.8 No placeholder content left behind

`Lorem ipsum`, `Untitled`, `test`, `foo`, `asdf`, `new Date()` output hardcoded
into a fixture, an empty object returned "temporarily". If it can be mistaken
for real data by the next reader, it is not a placeholder — it is a defect.

### 1.9 No duplication by copy

If the same four lines appear twice, the third copy is already written. Two
near-identical blocks that differ by one line are a single function with a
parameter. `no-duplicate-imports` catches the imports; only a human catches the
rest.

---

## 2. Enforcement

A rule with no gate is a preference. These are the gates:

| Rule | Frontend gate | Backend gate |
| --- | --- | --- |
| 1.1, 1.2, 1.7 | Review — nothing detects a claim | Review — nothing detects a claim |
| 1.2 dead code | `eslint` `no-unused-vars`, `no-unreachable` | `spotbugs`, `checkstyle` `UnusedImports` |
| 1.3 | `eslint` `no-warning-comments` (added in `FORMAT-LINT.md` §4) | `checkstyle` does not police prose; review does |
| 1.4 | `eslint` `complexity`, `max-depth` (added in `FORMAT-LINT.md` §4) | `spotbugs` `NP`, `checkstyle` `IllegalCatch` |
| 1.5 | Review — no rule for a bad filename | Review — no rule for a bad filename |
| 1.6 | `eslint` `no-unused-vars` on the caught binding | `checkstyle` `IllegalCatch`, `IllegalThrows` |
| 1.8 | `eslint` `no-warning-comments` + review | `spotbugs` + review |
| 1.9 | `eslint` `no-duplicate-*` | `checkstyle` `RedundantImport`, `FallThrough` |

The exact commands live in `05-development/FORMAT-LINT.md`. The rule exists so
that the list above is honest about what a tool can and cannot do: **rule 1.1
and 1.7 have no tool. They are yours.**

---

## 3. The review questions

Before approving anything in this repository, answer these five. If you cannot
answer one, the answer is "ask", not "assume".

1. **What did they run?** The command, and its result.
2. **What does this change delete?** A PR with no deletions is usually a PR
   that added something nobody needed.
3. **What does this add that nothing else owns?** New files, new deps, new
   config keys, new exported names.
4. **Which rule in §1 would this break if it were ten lines longer?**
5. **Would a reader of this file six months from now know why?** If the answer
   is in your head and not in the file, it is not in the file.

---

## 4. When slop is the right answer

Scaffolding. An empty repository that compiles, lints and has somewhere to put
the first real page is worth more than a perfect design written before any code
exists — `09-backend/SPRING-BOOT.md` §1 says so explicitly.

The distinction is whether the code **claims** something. A scaffolded view with
a heading and no data is honest. The same view with a spinner, an empty state
and an error handler is a claim that those paths were considered — and they
were not.

---

*See also: `02-governance/STANDARDS.md` for the rules this document does not
cover, `05-development/FORMAT-LINT.md` for the commands that enforce §2, and
`06-quality/AUDIT.md` for how slop already in the repository is found.*
