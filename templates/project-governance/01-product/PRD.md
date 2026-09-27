<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# PRD — {{MODULE_DISPLAY}}

| Field | Value |
| --- | --- |
| Module | `{{MODULE_NAME}}` |
| Repository | `{{REPO_NAME}}` |
| Kind | `{{MODULE_KIND}}` |
| Owner | {{OWNER}} |
| Version | {{MODULE_VERSION}} |
| API contract | v{{API_VERSION}} |
| Status | {{PRD_STATUS}} |
| Last reviewed | {{REVIEW_DATE}} |

---

## 1. Problem

{{PRD_PROBLEM}}

Write this before anything else. If you cannot state the problem in a paragraph
that a non-engineer would recognise, the module is not ready to be designed.

Good:

> Programme coordinators have no single place to see which training programmes
> exist, who runs them, and which are still missing the documents that make them
> usable. Today the list is maintained in spreadsheets and reconciled by hand,
> which takes two days a quarter and still produces duplicates.

Bad:

> We need a program module with tabs and a search bar and export to PDF.

The second is a solution wearing a problem's clothes. Send it back.

---

## 2. Who has the problem

| Role | What they need | How often |
| --- | --- | --- |
| {{PRD_USER_1}} | | |
| {{PRD_USER_2}} | | |
| {{PRD_USER_3}} | | |

Name real roles, matching the role ids in `03-architecture/AUTHENTICATION.md`.
A module that serves "users" serves nobody in particular, and the
requirements will be unprioritised forever.

---

## 3. What the module does today

{{PRD_CURRENT_STATE}}

Be honest about the gaps. This section is what `06-quality/AUDIT.md` will
measure against.

| Capability | Exists? | Where | Notes |
| --- | --- | --- | --- |
| {{PRD_CAP_1}} | | | |
| {{PRD_CAP_2}} | | | |

---

## 4. What the module must do

Each capability is a sentence a user could confirm is true or false. No
"support for", no "handling of", no "management of".

| ID | Capability | Why it matters | Priority |
| --- | --- | --- | --- |
| F1 | | | Must |
| F2 | | | Must |
| F3 | | | Should |
| F4 | | | Could |

### Explicitly out of scope

{{PRD_NON_GOALS}}

This list is load-bearing. It is the first thing you read when someone asks
for a small addition, and it is the list you point at in
`01-product/CHANGE-REQUEST.md` when the request turns out to be a new module.

---

## 5. Sub-modules

{{SUBMODULES_LIST}}

| Sub-module | Exposed page | Shell route | Owns |
| --- | --- | --- | --- |
| {{SUBMODULE}} | `{{SUBMODULE}}` | `{{ROUTE_PREFIX}}` | |

An exposed page is a **contract**. Renaming one breaks every Shell route that
imports it, and the failure surfaces in the browser as
`Module does not exist in container`, which points at the container rather than
at the rename. Renaming an expose is a major version bump — see
`07-delivery/VERSIONING.md`.

---

## 6. Success criteria

How we will know it worked, stated so it can be checked rather than felt.

| # | Criterion | How it is measured | Target |
| --- | --- | --- | --- |
| S1 | | | |
| S2 | | | |

If you cannot describe the measurement, it is a wish.

---

## 7. Constraints

| Constraint | Source | Effect on this module |
| --- | --- | --- |
| Module Federation host is the Shell | `03-architecture/ARCHITECTURE.md` | must expose pages, must not bootstrap |
| Shared singletons come from the Shell | `02-governance/GUARDRAILS.md` | cannot bundle `vue`/`pinia`/etc. |
| Backend authorizes independently | `03-architecture/AUTHENTICATION.md` | role guard is UX only |
| UI comes from the shared package | `04-design/UI-STANDARD.md` | no forked components in this repo |

---

## 8. Open questions

| # | Question | Blocks | Owner | Answered |
| --- | --- | --- | --- | --- |
| Q1 | | | | |

An open question that blocks nothing should be deleted, not carried.

---

## 9. Change history

| Date | Change | By | Reason |
| --- | --- | --- | --- |
| {{REVIEW_DATE}} | Initial PRD | {{OWNER}} | Module created |
