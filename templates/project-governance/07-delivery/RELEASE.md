<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# RELEASE — {{MODULE_NAME}}

How a version leaves this repository, and how it is recorded.

A release is not "merged to main". A release is a version, a tag, an artefact, a
verified deployment, and a record — or it is not a release.

---

## 1. What a release requires

| # | Requirement | Verified by |
| --- | --- | --- |
| R1 | The CR is approved and complete | `01-product/CHANGE-REQUEST.md` |
| R2 | The audit was run before development | `06-quality/AUDIT.md` |
| R3 | `CHECK` passes | `06-quality/CHECK.md` |
| R4 | Every test layer passes, including the failure cases | `06-quality/TESTING.md` |
| R5 | A real browser was opened and the change exercised | Playwright run + console/network |
| R6 | Every touched document is committed | `git show --stat` |
| R7 | The version number is correct | `07-delivery/VERSIONING.md` |
| R8 | `package.json` and `src/metadata.js` agree | Both say `{{MODULE_VERSION}}` |
| R9 | `07-delivery/SYNC.md` records the combination | §1 of that document |
| R10 | The build succeeds from a clean checkout | `npm ci && npm run build` |
| R11 | `remoteEntry.js` exists and is reachable, CORS-permitting | `curl` |
| R12 | The rollback target is known | The previous tag |

---

## 2. Procedure

```sh
# 1. Preconditions
git checkout main && git pull --ff-only
git status --porcelain            # must be empty
npx -y @lqmnwido/dreams-ai-skills-check

# 2. Build from the committed lockfile
npm ci
npm run build
test -f dist/remoteEntry.js && echo "container present"

# 3. Tests — the full chain
npm run test:unit
npm run test:component
npm run test:api
npm run test:contract
npm run test:e2e                 # requires the Shell running

# 4. Version
npm version <major|minor|patch> -m "<reason>"
# then update src/metadata.js to the same version

# 5. Review before tagging
git show --stat HEAD
git log --oneline main..HEAD

# 6. Tag
git tag -a v<version> -m "v<version>: <summary>"
git push origin main --follow-tags
```

| Step | Command | Pass |
| --- | --- | --- |
| 1 | governance check | |
| 2 | `npm ci && npm run build` | |
| 2 | `test -f dist/remoteEntry.js` | |
| 3 | every test layer | |
| 4 | `npm version` + `src/metadata.js` | |
| 5 | `git show --stat` — every touched document present | |
| 6 | `git tag -a` | |

---

## 3. Version selection

| Situation | Bump | Reason |
| --- | --- | --- |
| An expose key, remote name, route path or role id changed | **MAJOR** | A public contract broke |
| A documented API field changed shape | **MAJOR** | The contract broke |
| A required new prop on a consumed component | **MAJOR** | Consumers must change |
| A new exposed page | **MINOR** | Additive |
| A new capability, endpoint or translation key | **MINOR** | Additive |
| A `@2enapps/ui` minor bump | **MINOR** | A deliberate, tested change |
| A defect fix | **PATCH** | Nothing else changed |
| A documentation or comment change | **PATCH** | No behaviour change |

Full rules: `07-delivery/VERSIONING.md`.

---

## 4. Cross-repository releases

A release that affects more than one repository is a **sequence**, and the
sequence is the deliverable. The end state alone is not enough to reproduce what
happened.

| Order | Repository | Version | When | Verified |
| --- | --- | --- | --- | --- |
| 1 | Backend API | | before the frontend | |
| 2 | `@2enapps/ui` | | before its consumers | |
| 3 | `{{MODULE_NAME}}` | | after both | |
| 4 | Shell | | after the module is reachable | |

| Question | Answer |
| --- | --- |
| What if step 2 fails? | Roll back to the previous `@2enapps/ui` and pin consumers |
| What if step 3 fails? | Roll back this module; the Shell is unaffected |
| What if step 4 fails? | Roll back the Shell; the module is unaffected |
| What if the backend step fails? | Stop. Steps 2–4 are not started. |

**Every step is independently revertible.** A sequence where step 3 requires step
2 to be rolled back first is not a sequence, it is a deployment.

---

## 5. Release notes

Written for the person who has to decide whether to upgrade.

```markdown
## v<version> — {{REVIEW_DATE}}

### What changed
- 

### Breaking
- **<what>** → <what to do instead>

### Contracts
| Contract | Change | Action for consumers |
| --- | --- | --- |
| Expose key | | |
| API | | |
| `@2enapps/ui` | | |
| Role / route | | |

### Deploy order
1. 

### Rollback
Redeploy `v<previous>`. No data migration. No coordination required.

### Known issues
-
```

**"No breaking changes" is a claim, not a default.** Check the public contract
table in `07-delivery/VERSIONING.md` §1 and prove it.

---

## 6. Post-release

| # | Task | When |
| --- | --- | --- |
| 1 | Confirm the Shell route renders the deployed module | Immediately |
| 2 | Check the console and the network tab on the live route | Immediately |
| 3 | Verify the role-denied path still denies | Immediately |
| 4 | Update the matrix in `07-delivery/SYNC.md` | Immediately |
| 5 | Record the release below | Immediately |
| 6 | Watch the error rate for one business day | Day 1 |
| 7 | Close the CR | After 6 |
| 8 | Retrospective if anything was surprising | After 7 |

A release is not finished when it is tagged. It is finished when the deployed
artefact has been verified by someone loading the actual page.

---

## 7. Release log

| Version | Date | Type | Breaking | Repositories | Notes | Released by |
| --- | --- | --- | --- | --- | --- | --- |
| `{{MODULE_VERSION}}` | {{REVIEW_DATE}} | — | No | `{{REPO_NAME}}` | Initial release | {{OWNER}} |
| | | | | | | |

<!-- newest last -->
