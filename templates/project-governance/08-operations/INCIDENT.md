<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# INCIDENT — {{MODULE_NAME}}

What to do when it is broken for users, and what to write down while it is broken.

**This document is the process, not the fix.** The fix is a Change Request or a
debug entry. If you find yourself fixing code here, you have left the process:
open an incident, restore service, then fix it properly afterwards.

---

## 1. Declaration

> **An incident is declared when users are affected, not when the cause is
> known.** Waiting for a root cause is how a ten-minute fault becomes a
> two-hour one.

Declare on any of these, without needing permission:

- A user-visible route is broken
- Data is wrong, missing, or shown to the wrong user
- An authentication or authorization failure is affecting real users
- The module's container cannot be loaded
- Latency is far enough past target that people are complaining
- You cannot explain the failure and it is getting worse

**"It is probably the backend" is not an assessment.** A module that renders
nothing because one API returned 500 is still an incident for this module, and
the Shell users are still affected.

### The first ten minutes

| # | Action | Why |
| --- | --- | --- |
| 1 | Declare it. Name a lead. Open the timeline. | A declaration with no lead is nobody's job |
| 2 | Write the symptom in one sentence, from a user's view | "Nobody can open the program list", not "API 500s" |
| 3 | Establish the **start time** and whether it correlates with a deploy | Half of all incidents are a release, and the release is the fast hypothesis |
| 4 | Establish **scope**: which routes, which roles, which environments, all users or some | Decides severity and whether a rollback is safe |
| 5 | Check the release markers on the charts | `08-operations/MONITORING.md` §5 |
| 6 | If a deploy is suspected and the previous version is good, **roll back** | Do not debug in production. Restore first, diagnose second. |
| 7 | Post the first status update | Silence generates a second incident: the asking one |

---

## 2. Severity

Severity is about **impact on users**, not about how hard the fix looks.

| Severity | Definition | Examples | Response |
| --- | --- | --- | --- |
| **SEV-1** | The product is unusable, or data is at risk | Every user sees a blank module; a role can read another user's data; a write is corrupting records | Page immediately. Lead responds. Roll back now. |
| **SEV-2** | A core function is broken for many users | The primary list never loads; every save fails; a shared component breaks every page | Page during working hours. Roll back. Fix within the day. |
| **SEV-3** | A function is broken for some users | One role is denied wrongly; one sub-module 404s; a non-critical locale is wrong | Fix in the next release. Track it. |
| **SEV-4** | Cosmetic, or no user impact | A misaligned card; a console warning; a stale label | Backlog. Do not interrupt release work. |

### Two rules about severity

1. **Downgrade only with a reason, and write it down.** "It only affects one
   user" is a reason. "It's probably fine" is not.
2. **Security is always SEV-1, at any scale.** A leaked token, a data exposure,
   an authorization bypass: severity is set by the exposure, not the user count.
   `02-governance/SECURITY.md` §10 — and the disclosure path is different from a
   normal incident. Say so explicitly on the declaration.

---

## 3. Roles

One person per role. Two hats is acceptable in a SEV-1; three is not.

| Role | Owns | Does not |
| --- | --- | --- |
| **Incident lead** | Decisions, priorities, escalation, the clock | Hands-on debugging |
| **Communications** | Status updates, stakeholder replies, the incident channel | Diagnosing |
| **Investigator(s)** | Finding the cause, evidence, hypotheses | Talking to stakeholders |
| **Scribe** | The timeline, verbatim, in real time | Anything else |

> **The lead must not debug.** The failure mode of an incident is the lead
> going quiet for forty minutes while reading a stack trace, while three other
> people wait for a decision. Delegate the reading.

---

## 4. Procedure

```
  DECLARE      symptom in one sentence, start time, scope, severity
      ↓
  STABILISE    roll back, disable the feature, or fail over
      ↓
  MITIGATE     users are no longer affected — even if the cause is unknown
      ↓
  DIAGNOSE     evidence, in the DEBUG loop, with the timeline as the record
      ↓
  VERIFY       the reproduction no longer works, and the metrics recovered
      ↓
  RESOLVE      lead declares it resolved. Not "probably fixed".
      ↓
  REVIEW       postmortem, blameless, within five working days
```

### The stabilisation order

Always cheapest and safest first. Do not skip down the list because you are
sure about the cause.

| Order | Action | Time | Risk |
| --- | --- | --- | --- |
| 1 | Redeploy the previous tag of this module | ~1 min | None — the artefact is retained |
| 2 | Roll the shared package back in every consumer | ~10 min | A lockfile diff per repository |
| 3 | Roll the backend back | Minutes | Only safe if the change was additive |
| 4 | Disable the feature behind a flag | Minutes | A flag that exists is the only cheap off switch |
| 5 | Serve the Shell's fallback for the route | Minutes | Users get a degraded page, not a blank one |
| 6 | Fix forward | Hours | A fix in production during an incident causes a second incident |

**When the cause is a Shell change or an API change, this module is not the
unit of rollback.** Check every repository in `07-delivery/SYNC.md` §1 before
concluding that rolling this module back fixes anything.

### Things not to do during an incident

| Do not | Because |
| --- | --- |
| Fix forward in production | A second change on top of a bad state is a second incident |
| Refactor, upgrade a dependency, or "while we are in here" | Every change extends the timeline |
| Delete the console output | That is the evidence |
| Restart repeatedly hoping | It destroys state you cannot get back |
| Blame in the channel | You need the facts, not a culprit. The postmortem is where causes are examined. |
| Say "resolved" before the metrics recover | Users reload before your dashboard updates |
| Change the environment variables to make it work | The build is bound to its environment. `07-delivery/DEPLOYMENT.md` §1. |

---

## 5. The timeline

Append-only. One line per event, with a time and who did it. Do not rewrite
history to make it read better — that is the one artefact whose value is
proportional to its accuracy.

| Time | Event | Actor | Note |
| --- | --- | --- | --- |
| {{REVIEW_TIME}} | Alert fired: container probe failing | monitoring | `remoteEntry.js` non-200 |
| | | | |
| | | | |

### What to capture while you work

- The first symptom, and how it was reported (monitoring, user, tester)
- Every command you ran, with its output — verbatim, in the channel
- Every deployment, rollback, config change and flag flip, with its time
- Every hypothesis, and whether it was disproved
- Every decision, and the reasoning at the time
- User reports, especially the first one that does not match the monitoring signal

> **Record the reasoning at the time, not afterwards.** Reconstructed
> reasoning is always more confident than the reasoning actually was, and that
> is precisely the information a postmortem loses.

---

## 6. Communication

| When | What | To |
| --- | --- | --- |
| On declaration | The symptom, the scope, the severity, the lead | The team, the incident channel |
| Every 30 min (SEV-1) | The same four facts, updated | The same |
| Every 60 min (SEV-2) | | |
| On mitigation | What was done, and what is still broken | Users, stakeholders |
| On resolution | What happened, and the fix in one line | The same |
| After review | The postmortem link | Everyone, permanently searchable |

**Write for someone who is not in the incident.** No internal shorthand, no
error messages as the explanation, no "fixed the thing". "The program list page
shows an error instead of the list, for all users on the production Shell" is a
status update.

### Do not

| Do not | Why |
| --- | --- |
| State a cause before it is confirmed | A wrong cause in a status update becomes the accepted narrative, and the real cause is found later from a fix that does not work |
| Speculate in public | Write the hypothesis in the channel, the conclusion in the timeline |
| Announce "fixed" before the metrics are clean | Users reload before your dashboard updates |
| Discuss security details in a shared channel | `02-governance/SECURITY.md` §10 |

---

## 7. Postmortem

**Blameless. Always.** The question is why the system allowed this, never who
made the mistake. A process that punishes reporting gets fewer reports and the
same defects.

| Section | Content |
| --- | --- |
| **Summary** | What happened, in three sentences, in the past tense |
| **Impact** | Who was affected, for how long, and what it cost them |
| **Detection** | How it was found, and how long before anyone noticed |
| **Timeline** | The §5 table, unedited |
| **Root cause** | The technical chain, not the person |
| **Contributing factors** | The conditions that let it happen: a missing test, an unowned alert, a branch dependency |
| **What went well** | Real, not polite. Something always went right, and knowing what protects it matters. |
| **Action items** | Each with an owner and a due date, in a tracked issue |

### The action items that count

| Action | Why it matters |
| --- | --- |
| A test that fails before the fix | The only action that prevents the same defect |
| A check added to `06-quality/CHECK.md` | Prevents the pattern, not the instance |
| A guardrail added to `02-governance/GUARDRAILS.md` | Prevents the whole class |
| An alert that would have caught it earlier | Closes the detection gap |
| A rollback that was not one step | Closes the recovery gap |

> **An incident with no test and no checklist change has not been resolved, only
> survived.** The same defect will return with a different trigger, and the next
> occurrence will be during someone else's release.

### Cross-repository incidents

An incident that spans the Shell, a module and the backend is not three
incidents. It is one incident with three owners.

- One lead, across repositories. Not one per team.
- One timeline. Append the other repositories' events to it.
- A CR is filed in **every** affected repository, even the one that was only a
  victim of the change.
- `07-delivery/SYNC.md` §1 is updated with the combination that failed, marked
  `⚠️`, so nobody re-tests it as if it were new.

---

## 8. The incident record

```markdown
### INC-{{INCIDENT_NUMBER}} — <symptom, from the user's point of view> — {{REVIEW_DATE}}

**Declared:** {{REVIEW_TIME}} by {{OWNER}}
**Severity:** SEV-{{SEVERITY}} ({{SEVERITY_REASON}})
**Resolved:** {{REVIEW_TIME}} · duration {{DURATION}}
**Commits / artefacts:** <the release, and the rollback target>

**Impact**

**Detection** <monitoring | user | tester> · <how long before it was noticed>

**Timeline**

| Time | Event | Actor |
| --- | --- | --- |
| | | |

**Cause**

**Contributing factors**

**Action items**

| # | Action | Type | Owner | Due |
| --- | --- | --- | --- | --- |
| 1 | | test / check / guardrail / alert | | |
```

---

## 9. Severity and response quick reference

| Symptom | Default severity | First action |
| --- | --- | --- |
| The Shell route renders the fallback for everyone | SEV-1 | `curl` the container. Roll the module back. |
| `Module does not exist in container` after a deploy | SEV-1 | The expose key diverged. Roll the Shell back, or re-release the module with the matching key. |
| The primary data region never loads | SEV-2 | Network tab → the API. Is the base `undefined`? |
| Saves fail for everyone | SEV-2 | Check the API first; the audit helper path is the second suspect |
| A role is denied wrongly | SEV-2 | Compare route role, menu role and API role |
| One sub-module 404s | SEV-3 | `capaianUrl` vs the route path |
| Data shown to the wrong user | SEV-1 · security | Do not debug. Preserve evidence, escalate immediately |
| Console errors only, page works | SEV-4 | Backlog |
| The Shell is slow, not this module | Not this incident | The Shell's own incident, with this module as a stakeholder |

---

## 10. Drill

| Cadence | Drill |
| --- | --- |
| Monthly | Roll the module back and confirm it takes under 5 minutes |
| Quarterly | Declare a SEV-1 in a drill channel: template, timeline, roles, 30-minute update |
| Quarterly | A security drill: confirm the escalation path reaches the right person |
| After every SEV-1 or SEV-2 | A drill of that exact failure mode |

> **A rollback that has never been performed is not a rollback plan.** Static
> files make it possible to test in five minutes. Do it, and write down what was
> actually observed.
