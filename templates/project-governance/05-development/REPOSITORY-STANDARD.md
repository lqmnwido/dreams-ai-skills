<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# REPOSITORY STANDARD — {{REPO_NAME}}

The shape every D-ReAMS repository has, so that a person — or an agent — moving
between them knows where to look.

Deviating from this standard is possible and occasionally right. It is a Change
Request, not a preference.

---

## 1. Required files

```
{{REPO_NAME}}/
├── AGENTS.md                       AI agent entry point (router)
├── README.md                       human entry point
├── .docs/
│   ├── install.json                what the installer recorded
│   └── project-governance/         the governance tree
├── .env.example                    every variable, values empty
├── .env                            NOT committed
├── .gitignore
├── babel.config.js
├── package.json
├── vue.config.js                   or vite.config.js for a library
├── public/
├── src/
│   ├── metadata.js                 federation identity (remotes and the Shell)
│   ├── remote-entry.js             remote build entry
│   ├── preview/                    standalone preview
│   ├── services/<module>/
│   ├── state/
│   ├── locales/<module>/
│   └── views/
└── tests/
```

| File | Why it must exist |
| --- | --- |
| `AGENTS.md` | An agent must be able to find the rules without being told |
| `.docs/project-governance/` | The decisions, written down |
| `.env.example` | The variable list, discoverable without a real `.env` |
| `README.md` | A human arrives before an agent does |
| `src/metadata.js` | Stable identity, for remotes |
| `src/preview/` | The fast development loop |

---

## 2. `.gitignore`

```gitignore
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
npm-debug.log*
.DS_Store
coverage/
test-results/
playwright-report/
.idea/
.vscode/*
!.vscode/extensions.json
*.bak
*.bak.*
```

| Rule | Why |
| --- | --- |
| `.env` ignored, `.env.example` committed | No secret in history |
| `dist/` ignored | Built output is not source |
| `*.bak` ignored | The installer makes backups; they are not part of the project |
| `package-lock.json` **not** ignored | It is the reproducibility record |

**`.env` in git history is compromised.** Removing it later does not undo it.
Rotating the value is the only remedy.

---

## 3. Branches

| Branch | Purpose | Merged by |
| --- | --- | --- |
| `main` | Released, always deployable | Release process |
| `develop` | Integration | — |
| `feature/<scope>-<short>` | One CR | PR |
| `fix/<short>` | One defect | PR |
| `release/<version>` | Release preparation | Release process |

Rules:

- `main` is always deployable. No commit is pushed straight to it.
- A branch is one CR or one defect.
- Long-lived branches accumulate the conflicts that make a release slow. Merge
  `develop` back into a long-running branch weekly.
- No force-push to a shared branch. Rewriting published history is a security
  event, not a convenience.

---

## 4. Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[body]

[footer]
```

| Type | Use |
| --- | --- |
| `feat` | A new capability |
| `fix` | A defect fix |
| `docs` | Documentation only |
| `refactor` | Behaviour unchanged |
| `test` | Tests only |
| `perf` | A performance change |
| `build` | Build or dependencies |
| `chore` | Maintenance |

| Rule | Why |
| --- | --- |
| One commit does one thing | A revert that takes the fix with it |
| The subject says what, not how | The changelog is generated from it |
| The body says **why** | The diff already says what |
| A behaviour change updates its document | The next reader needs both |
| No `WIP` in a merged commit | A commit history is a log, not a scratchpad |
| Never commit commented-out code | Git remembers it |
| Never commit a secret | See `02-governance/SECURITY.md` |

---

## 5. Repository identity

| Field | Value |
| --- | --- |
| `name` | `{{REPO_NAME}}` |
| `version` | `{{MODULE_VERSION}}` |
| `private` | `true` |
| `description` | one line, what it is |
| Remote name | `{{MODULE_NAME}}` |
| Kind | `{{MODULE_KIND}}` |

The remote name in `package.json`'s scope and the federation `name` are usually
the same string for historical reasons. They are not the same contract, and a
change to one does not change the other. `07-delivery/VERSIONING.md` §4.

---

## 6. What a repository must never contain

| Never | Why |
| --- | --- |
| A client secret | A frontend bundle is public |
| `.env` | See §2 |
| A second Keycloak client | See `02-governance/GUARDRAILS.md` §1 |
| A forked copy of a shared component | It diverges |
| A second copy of a shared singleton | See `03-architecture/ARCHITECTURE.md` §3.6 |
| Hardcoded URLs, ports or buckets | They break per environment |
| Committed `dist/` | Build output is not source |
| A `package.json` with an unreviewed dependency | See `05-development/TOOLS.md` |
| A commented-out block | Git remembers it |
| A `console.log` in a view | Debug output shipped |
| Source maps in production | `productionSourceMap: false` |

---

## 7. Documentation obligations

| Trigger | Update | In the same commit |
| --- | --- | --- |
| Ownership changes | `01-product/SCOPE.md` | yes |
| A capability changes | `01-product/PRD.md` | yes |
| A contract changes | `03-architecture/API-CONTRACT.md` | yes |
| A module is registered | `03-architecture/INTEGRATION.md` | yes |
| Auth or roles change | `03-architecture/AUTHENTICATION.md` | yes |
| A decision is contested | `03-architecture/ADR.md` | yes |
| A pattern is added | `04-design/TEMPLATE.md` | yes |
| A dependency is added | `05-development/TOOLS.md` | yes |
| Behaviour changes | `06-quality/DEBUG.md` or a CR | yes |
| Another repository is affected | `07-delivery/SYNC.md` | yes |
| A version is released | `07-delivery/RELEASE.md` | yes |
| A procedure changes | `08-operations/RUNBOOK.md` | yes |

**A behaviour change without a documentation change is an incomplete change.**
This is the single most common way documentation rots: the code ships, the
document is "for the next PR", and the next PR never comes.

---

## 8. Review checklist

- [ ] `package.json` unchanged, or `05-development/TOOLS.md` updated
- [ ] No `.env`, no secret, no `dist/`, no `*.bak`
- [ ] `package-lock.json` committed if a dependency changed
- [ ] One commit does one thing
- [ ] Every touched document is in the same commit
- [ ] `npx -y @lqmnwido/dreams-ai-skills-check` passes
- [ ] `07-delivery/SYNC.md` checked for cross-repository impact
- [ ] Tests include the failure case
