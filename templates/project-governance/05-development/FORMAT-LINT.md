<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# FORMAT-LINT — {{MODULE_NAME}}

How this repository is formatted, what is linted, and which command fails when
either is wrong.

Formatting is not a style opinion. It is the difference between a diff that
shows a real change and a diff that shows a re-indentation — and a
re-indentation is where a reviewer stops reviewing.

Two rules govern this document:

1. **One tool owns each concern.** Formatting is not also checked by the linter,
   and structure is not also checked by the formatter. Two tools claiming the
   same territory is how an unfixable build happens.
2. **The gate runs in the build, not in a wiki.** Every command below is bound
   to a Maven phase or an npm script; none of them depends on someone
   remembering.

---

## 1. The gate

| Repository | Command | What it runs, in order |
| --- | --- | --- |
| {{FRONTEND_REPO}} | `npm run verify` | `prettier --check`, then `eslint` |
| {{BACKEND_REPO}} | `mvn verify` | `spotless:check`, `checkstyle:check`, tests, `spotbugs:check` |

Both are exit-code gates. A non-zero exit means the change is not mergeable.
Neither command repairs anything by itself — see §2.1 and §3.1 for the repair
command, which is always a separate, deliberate invocation.

---

## 2. Frontend

### 2.1 Formatting — Prettier

```bash
npm run format          # rewrite (the only command that changes files)
npm run format:check    # report only — this is the gate
```

Configuration: `.prettierrc.json`, committed. Scope: `src/**/*.{js,vue,json,css}`.

Prettier has no configuration to argue about. Single quotes, semicolons,
100 columns, two-space indent, `es5` trailing commas, LF. Changing any of these
is a Change Request against this document, because it rewrites every file in
the repository at once.

### 2.2 Linting — ESLint

```bash
npm run lint          # autofix + report
npm run lint:check    # report only — this is the gate
```

Configuration: `.eslintrc.cjs`, committed. Groups:

| Group | Rules |
| --- | --- |
| Errors, no discussion | `no-debugger`, `no-var`, `eqeqeq`, `vue/no-mutating-props`, `import/order` |
| Warnings, reviewed not blocked | `no-console` (warn/error only), `vue/attributes-order`, `import/no-unresolved` |
| Deliberately off | `vue/multi-word-component-names` — a route-level page is legitimately one word |

`eslint-config-prettier` is last in `extends`. It turns off every rule that
would disagree with Prettier, so the two tools can never both be right and both
fail.

---

## 3. Backend

### 3.1 Formatting — Spotless with the Spring Java Format

```bash
mvn spotless:apply     # rewrite (mechanical, never hand-edit formatting)
mvn spotless:check     # report only — bound to `validate`
```

Configuration: `pom.xml` → `spotless-maven-plugin`. Scope: `src/main/java` and
`src/test/java`.

The Spring Java Format is the platform's Java style: four-space indent, Spring's
import order, blank line rules, 120-column wrapping. It is a formatter, so it
never reorders imports to satisfy an opinion — `checkstyle` owns imports
(§3.2).

**If `spotless:check` fails on a file you did not mean to change, run
`mvn spotless:apply` and re-stage it.** Do not fix indentation by hand: the next
run will disagree with you.

### 3.2 Structure — Checkstyle

```bash
mvn checkstyle:check   # bound to `validate`
```

Configuration: `config/checkstyle/checkstyle.xml`, committed.

| Rule | What it stops |
| --- | --- |
| `UnusedImports`, `RedundantImport`, `AvoidStarImport` | Dead imports, hidden dependencies |
| `FileTabCharacter`, `LineLength` | The first sign of an editor that is not the team's |
| `NeedBraces`, `EmptyBlock` | `if (x) doThing();` and empty `catch` |
| `EqualsHashCode`, `StringLiteralEquality`, `SimplifyBoolean*` | Correctness bugs hiding as style |
| `FallThrough`, `MissingSwitchDefault` | Silent fall-through |
| `IllegalCatch`, `IllegalThrows` | `catch (RuntimeException)` and `throws Exception` — a declaration that declares nothing |

Deliberately absent: import **order**, javadoc requirements, method length, and
naming conventions beyond what the compiler enforces. Each of those is either
the formatter's job or a matter of taste; enforcing taste as a build failure is
how a team stops running the build.

### 3.3 Analysis — SpotBugs

```bash
mvn spotbugs:check     # bound to `verify`
```

Configuration: `pom.xml` and `config/spotbugs/exclude.xml`, committed.

Effort `Max`, threshold `Medium`. The exclusion file is **empty on purpose**: an
exclusion list that starts full is a list nobody shortens. An entry may be added
only with a comment naming the finding, why it is safe *here*, and the date.

---

## 4. Extra rules worth turning on

The scaffold ships the rules above. These are the ones that catch slop a
formatter cannot, and they are worth adding when the codebase is large enough
for them to earn their noise:

| Rule | Where | What it catches |
| --- | --- | --- |
| `complexity`, max 10 | `.eslintrc.cjs` → `rules` | A function that made sense until the third branch |
| `max-depth`, max 3 | `.eslintrc.cjs` → `rules` | The nested `if` that needs guard clauses |
| `no-warning-comments` | `.eslintrc.cjs` → `rules` | Bare `TODO`/`FIXME` with no change-request id |
| `checkstyle` `ClassFanOutComplexity` | `config/checkstyle/checkstyle.xml` | A class depending on everything |
| `spotbugs` threshold `High` | `pom.xml` | Tightening once the medium findings are gone |

Adding a rule is a Change Request against this document (`01-product/CHANGE-REQUEST.md`),
and it must be accompanied by the command that already passes with the rule
enabled. A rule added in the same commit that violates it is a rule nobody
intends to keep.

---

## 5. CI order

The order is chosen so the cheapest failure is reported first:

1. `prettier --check` / `mvn spotless:check` — mechanical, seconds
2. `eslint` / `mvn checkstyle:check` — structural, seconds
3. Tests — the first thing that can need a fixture
4. `mvn spotbugs:check` — bytecode analysis, the slowest

A CI run that fails at step 1 has told the author nothing about their logic,
which is correct: fixing indentation before reading a stack trace wastes both.

---

## 6. Common failures

| Message | Cause | Fix |
| --- | --- | --- |
| `Code style issues found in N files` | A file was hand-edited or written by a tool with different settings | `npm run format` |
| `'x' is assigned a value but never used` | A leftover from a removed branch | Delete it, or prefix with `_` if it is intentional |
| `Module level directives are not supported` | A `// eslint-disable` at the top of a file | Scope it to the line |
| `spotless:check failed` | Indentation or line wrapping | `mvn spotless:apply` |
| `UnusedImports` | An import left behind by a deletion | Remove it |
| `IllegalCatch` | `catch (RuntimeException e)` | Catch the domain exception the boundary throws (`09-backend/SPRING-BOOT.md` §5) |

---

*See also: `02-governance/ANTI-SLOP.md` for which offences these tools cannot
catch, `02-governance/QUALITY.md` for the quality gates themselves, and
`05-development/TOOLS.md` for the approved dependency list.*
