<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# AUDIT — {{MODULE_NAME}}

**What exists today, recorded before development starts.**

An audit is not a code review. It is a record of the current state, gathered
before anything changes, so that afterwards you can prove what moved — and so
that the next person does not have to rediscover it.

A CR that skips the audit is built on an assumption about the existing code.
Sometimes the assumption is right. When it is not, the audit is the difference
between a small fix and an incident.

---

## 1. When to run one

| Trigger | Depth |
| --- | --- |
| New feature | Full audit of the affected area |
| Change Request | Full audit of the affected area |
| Debug | Reproduction audit, §3 |
| A dependency or contract change | Cross-repository audit, §6 |
| A release | Verification audit, §7 |

---

## 2. The audit record

One entry per audit, newest last. Never overwrite an entry — an audit that
disappears is an audit nobody can check.

```markdown
### AUDIT-001 — <what was audited> — {{REVIEW_DATE}}

**Trigger:** new-feature | change-request | debug | release
**By:** 
**Scope:** <paths, endpoints, contracts>

#### What exists

| Path / component | Behaviour today | Notes |
| --- | --- | --- |

#### How it was verified

<the exact command run and what it printed, or the steps taken in the browser>

#### Findings

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| F1 | | blocker / major / minor / note | |

#### What this means for the change

- 
- 

#### Left unresolved

- [ ] <question> — owner, needed by when
```

---

## 3. Debug audit — the reproduction

For a defect, the audit is a reproduction record. Do not start fixing until this
is filled in.

| Field | Value |
| --- | --- |
| Symptom | What is observed, in one sentence |
| Environment | Repository, branch, commit, `.env` mode, Shell on/off, backend |
| Steps | Numbered, from a clean state, so someone else can follow them |
| Expected | What should happen |
| Actual | What happens |
| Reproducible? | always / sometimes / once — **"sometimes" is itself a finding** |
| First seen | {{DEBUG_FIRST_SEEN}} |
| Blast radius | Who else is affected |
| Console / network | The error, the request, the response status |

### Capture before changing anything

```sh
git rev-parse HEAD
git status --porcelain
curl -sS -o /dev/null -w '%{http_code}\n' "$BASE/remoteEntry.js"
```

A defect that cannot be reproduced is not a defect you can fix. It is either a
misreport or a race — and both need different investigations.

---

## 4. What to audit

### 4.1 The code

| Question | Where to look |
| --- | --- |
| What does this path actually do? | Read it, do not infer from the name |
| What does it call? | Follow every service function to its endpoint |
| What state does it own? | `data`, a store, or both — two owners is a finding |
| What is duplicated? | Grep for a helper that may already exist |
| What is dead? | No route, no expose, no import |
| What is inherited legacy? | A comment that says "original" with no explanation |
| What is load-bearing and undocumented? | A workaround with no note |

### 4.2 The contract

| Question | Why |
| --- | --- |
| Which expose keys does the Shell import? | A rename is a breaking change |
| Which API endpoints does this call? | A shape change is a cross-repository change |
| Which roles reach this? | A role change is a security change |
| Which environment variables does it read? | A missing one produces `undefined` in a URL |
| Which shared components does it use? | A version change can remove an export |
| Which of those is in `07-delivery/SYNC.md`? | The compatibility record |

### 4.3 The runtime

| Question | Why |
| --- | --- |
| Does it render in preview mode? | The fast loop, and it isolates the module |
| Does it render through the Shell? | The real integration |
| What does the browser console say? | The first place a silent failure appears |
| What is in the network tab? | CORS, `404`, a payload that is `undefined` |
| What is the response to a request with no token? | The security boundary |

### 4.4 The tests

| Question | Why |
| --- | --- |
| What is covered? | The gap is where the defect will be |
| What is skipped, and why? | A skip without a reason is a disabled test |
| Do they pass now? | A pre-existing failure is a finding, not your problem |
| Is the failure path covered? | Fixes usually only handle the happy path |

---

## 5. Severity

| Severity | Meaning | Action |
| --- | --- | --- |
| **Blocker** | A guardrail violation, a security defect, a data-loss risk | Stop. Do not build on it. |
| **Major** | Wrong behaviour, a broken contract, an unreachable page | Fix or file before proceeding |
| **Minor** | A violation of `02-governance/STANDARDS.md` with no behavioural effect | Fix in this change |
| **Note** | An observation, a question, a possible improvement | Record; do not act |

Do not inflate a `note` to a `major` to make the audit look thorough, and do not
demote a `blocker` because the current change is nearly finished.

---

## 6. Cross-repository audit

For a change that touches more than one repository, the audit is the point at
which the coordination cost becomes visible.

| Repository | What changes there | Compatible today? | Owner notified |
| --- | --- | --- | --- |
| Shell | | | |
| `@2enapps/ui` | | | |
| {{BLAST_RADIUS}} | | | |

| Check | How |
| --- | --- |
| Does the Shell's route still import the expose? | Compare the strings |
| Is the role in the route, the fixture **and** the API? | Three places, or the user is denied or over-permitted |
| Is the API shape unchanged, or is a version bump coordinated? | `03-architecture/API-CONTRACT.md` |
| Is the `@2enapps/ui` version in the compatibility matrix? | `07-delivery/SYNC.md` |
| Is there a deployment order? | Which repository must go first |

**A cross-repository change with no deployment order is a planned outage.**

---

## 7. Release audit

Before a release:

| # | Check | Pass |
| --- | --- | --- |
| 1 | `npx -y @lqmnwido/dreams-ai-skills-check` | |
| 2 | `npm run build` succeeds, `remoteEntry.js` present in the output | |
| 3 | The container is reachable from the Shell origin, CORS-permitting | |
| 4 | All tests pass, including the failure cases | |
| 5 | The module renders through the Shell, in a real browser | |
| 6 | A permitted user can use it; an unpermitted user cannot | |
| 7 | Every touched document is committed | |
| 8 | `07-delivery/SYNC.md` reflects the released version | |
| 9 | The rollback is known and, where possible, tested | |

---

## 8. Audit log

<!-- append one entry per audit, newest last -->

### AUDIT-001 — Initial module audit — {{REVIEW_DATE}}

**Trigger:** new-feature
**By:** {{OWNER}}
**Scope:** the whole module

#### What exists

| Path / component | Behaviour today | Notes |
| --- | --- | --- |
| `src/views/{{SUBMODULE}}.vue` | {{AUDIT_VIEW_NOTE}} | |
| `src/services/{{MODULE_NAME}}/http.js` | Module transport; credentials via the host adapter | |
| `src/metadata.js` | Frozen identity: `{{MODULE_NAME}}`, `{{ROUTE_PREFIX}}` | |
| `src/preview/` | Standalone entry for `VUE_APP_REMOTE=off` | |

#### Findings

| # | Finding | Severity | Evidence |
| --- | --- | --- | --- |
| F1 | | | |
| F2 | | | |

#### What this means for the change

- 

#### Left unresolved

- [ ] 

#### Change history

| Date | Audit | By | Result |
| --- | --- | --- | --- |
| {{REVIEW_DATE}} | AUDIT-001 | {{OWNER}} | Initial |
