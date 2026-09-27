<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# CHECK — {{MODULE_NAME}}

**Static verification, before anything is run.**

`CHECK` and `TEST` are different things. `TEST` asks *does it work?* `CHECK` asks
*is this even the right code?* A test suite that passes over code violating the
architecture is a green light on the wrong building.

**Order is not negotiable: `CHECK`, then `TEST`.**

---

## 1. The five checks

| # | Check | Question | Why |
| --- | --- | --- | --- |
| 1 | **Architecture** | Does it respect the ecosystem rules? | A violation is a cross-repository incident waiting to happen |
| 2 | **Standards** | Does the code look like the rest of this repository? | Inconsistency is what makes a bug unfixable |
| 3 | **Security** | Does it leak, trust or expose anything it must not? | The cheapest place to catch this |
| 4 | **Dependencies** | Is everything installed, and nothing extra? | Supply chain and reproducibility |
| 5 | **Code quality** | Is this free of slop? | Slop is unreviewed code that looks reviewed |

---

## 2. Architecture

```sh
# Federation contract: the expose keys and the Shell imports must match exactly.
grep -n "exposes" vue.config.js
grep -rn "Module does not exist\|does not exist in container" ../shell/src 2>/dev/null

# The shared singletons must be declared, and must not be eager in a remote.
grep -n -A20 "shared:" vue.config.js

# The symlink trap: both settings, and the setter-call form.
grep -n "resolve.symlinks" vue.config.js        # must be: config.resolve.symlinks(false)
grep -n 'resolve.alias.set' vue.config.js        # must be: `${name}$`, exact match

# A module must not own Shell concerns.
grep -rn "keycloak\|Keycloak" src/               # must be empty
grep -rn "createRouter" src/ | grep -v preview  # only the preview entry builds a router
grep -rn "LayoutVertical\|LayoutHorizontal\|AppSideBar" src/   # must be empty

# Source maps must not ship.
grep -n "productionSourceMap" vue.config.js      # must be: false
```

| Finding | Severity |
| --- | --- |
| An expose key or remote name differs from the Shell's | **Blocker** |
| A shared singleton missing from `shared` | **Blocker** |
| `resolve.symlinks` assigned rather than called | **Blocker** |
| `eager: true` added in a remote | **Blocker** |
| A layout, sidebar or navbar in a view | **Blocker** |
| `productionSourceMap: true` | **Blocker** |
| A `console.log` in a view | Minor |

---

## 3. Standards and slop

```sh
# Debug output left in a view.
grep -rn "console\.log" src/views/ src/services/

# Empty catch blocks: the failure is now invisible.
grep -rn "catch\s*{\s*}\|catch\s*([^)]*)\s*{\s*}" src/

# Commented-out code.
grep -rn "^\s*//\s*[a-z].*[;{})]\s*$" src/ | grep -vE "eslint|http|https"

# TODO with no owner and no ticket.
grep -rn "TODO\|FIXME\|XXX\|HACK" src/

# Hardcoded environment values in source.
grep -rnE "https?://(localhost|127\.0\.0\.1|[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)" src/

# Duplicated helper: does one already exist?
grep -rn "function formatDate\|function formatCurrency\|function debounce" src/

# User-visible strings outside the translation system.
grep -rnE '>[[:space:]]*[A-Z][a-z]+ [a-z]+ [a-z]+' src/views/ | grep -v "{{"

# A view reaching for fetch directly, bypassing the service layer.
grep -rn "fetch(" src/views/
```

### The slop table

| Pattern | Why it is rejected |
| --- | --- |
| A comment restating the line below | Noise that hides real comments |
| `console.log` left in a view | Debug output shipped |
| An empty `catch {}` | A bug became silence |
| `TODO` with no owner and no ticket | It will not happen |
| Commented-out code | Git remembers it |
| A hardcoded `localhost` or IP | Breaks in every deployed environment |
| A helper duplicated per feature | Fix one, ship the other |
| A `fetch` inside a view | Bypasses the audit and the transport |
| An inline string in a template | Missing from five locales |
| Prose in a comment that reads as marketing | Says nothing a reviewer can check |

---

## 4. Security

```sh
# Secrets in the working tree.
grep -rnE "(api[_-]?key|secret|password|token|client[_-]?secret)\s*[:=]\s*['\"][^'\"]{8,}" src/ \
  --include=*.js --include=*.vue

# .env must never be committed.
git ls-files | grep -E "^\.env$|\.env\.local$"

# Private keys and certificates.
git ls-files | grep -E "\.(pem|key|p12|pfx|jks)$"

# The role-guard bypass must be local only.
grep -rn "VUE_APP_SKIP_ROLE_CHECK" . --include=".env*" --include="*.js" --include="*.yml" --include="*.yaml"

# Unsafe HTML rendering.
grep -rn "v-html" src/

# New windows without noopener.
grep -rn 'target="_blank"' src/ | grep -v "noopener"

# Personal data in logs.
grep -rn "console\.\(log\|warn\|error\)" src/ | grep -iE "noKai|icNo|phone|email|address|alamat"
```

| Finding | Severity |
| --- | --- |
| A secret in source or history | **Blocker** — rotate it, then remove it |
| `.env` committed | **Blocker** — rotate every value in it |
| `VUE_APP_SKIP_ROLE_CHECK` in a deployable config | **Blocker** |
| `v-html` on unsanitised input | **Blocker** |
| `target="_blank"` without `rel="noopener"` | Major |
| Personal data in a log | **Blocker** |
| Source maps in a deployable build | **Blocker** |
| A dependency with an unreviewed `postinstall` | Major |

Full rules: `02-governance/SECURITY.md`.

---

## 5. Dependencies

```sh
# The build works from a clean install.
rm -rf node_modules && npm ci

# The lockfile is present and committed — a git branch dependency is not
# immutable without it.
test -f package-lock.json && git ls-files package-lock.json

# Nothing is installed globally, which is what the project standard requires.
npm ls --depth=0

# Every dependency is in the approved list.
node -e "const a=require('./package.json'),b=require('fs').readFileSync('.docs/project-governance/05-development/TOOLS.md','utf8');const d={...a.dependencies,...a.devDependencies};for(const k of Object.keys(d))if(!b.includes(k))console.log('UNAPPROVED:',k,d[k])"

# No peer duplication that would break the singletons.
find node_modules/@2enapps -maxdepth 3 -name node_modules -type d 2>/dev/null

# Advisories.
npm audit --audit-level=high
```

| Finding | Severity |
| --- | --- |
| A dependency not in `05-development/TOOLS.md` | **Blocker** — Change Request first |
| `package-lock.json` missing or uncommitted | **Blocker** |
| A peer of the four singletons at a different version | **Blocker** |
| A high-severity advisory | **Blocker** |
| A `postinstall` script | Major — review before merging |

---

## 6. Documentation and sync

```sh
# This repository's own governance tree.
npx -y @lqmnwido/dreams-ai-skills-check

# Unresolved placeholders: a visible gap, or an invented answer.
grep -rn "{{[A-Z_]*}}" .docs/project-governance/

# Cross-repository impact: the diff against the base.
git diff --name-only main...HEAD
```

| Check | Pass |
| --- | --- |
| Every document the change invalidated is in the same commit | |
| `07-delivery/SYNC.md` reflects any cross-repository change | |
| A contract change has a coordinated version bump | |
| No `{{TOKEN}}` was filled with a guess | |

---

## 7. The CHECK record

Run it per change, not per release. Paste the real output.

```markdown
### CHECK-{{CHECK_NUMBER}} — {{REVIEW_DATE}}

Scope: `{{CHECK_SCOPE}}`
By: {{OWNER}}

| # | Check | Command | Result |
| --- | --- | --- | --- |
| 1 | Architecture | | pass / fail |
| 2 | Standards | | |
| 3 | Security | | |
| 4 | Dependencies | | |
| 5 | Code quality | | |
| 6 | Documentation | | |

**Findings**

| # | Finding | Severity | Action |
| --- | --- | --- | --- |

**Verdict:** pass \| pass with minors \| fail
```

A `CHECK` that reports "looks good" is not a `CHECK`.

---

## 8. Verdict

| Verdict | Meaning | What happens |
| --- | --- | --- |
| **pass** | No findings above minor | Proceed to `06-quality/TESTING.md` |
| **pass with minors** | Only minor findings, all fixed in this change | Proceed, list the fixes |
| **fail** | Any blocker or major | Stop. Fix, then re-run |

**A blocker is never a "known issue" to be fixed later.** Every one of them is a
failure mode that is silent, expensive, or both — which is exactly why they are
written down.

---

## 9. Checklist

- [ ] Federation expose keys match the Shell's imports, byte for byte
- [ ] The four shared singletons declared, none `eager`
- [ ] `resolve.symlinks(false)` is a setter call, and the peer aliases use `$`
- [ ] No Keycloak, router or layout code in the module
- [ ] `productionSourceMap: false`
- [ ] No `console.log`, empty `catch`, `TODO`, or commented-out code
- [ ] No hardcoded URL, port, bucket or role
- [ ] No secret, no `.env`, no personal data in a log
- [ ] No dependency outside `05-development/TOOLS.md`; lockfile committed
- [ ] Every touched document updated in the same commit
- [ ] `npx -y @lqmnwido/dreams-ai-skills-check` passes
