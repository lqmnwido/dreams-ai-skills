<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# SECURITY — {{MODULE_NAME}}

Security rules for `{{MODULE_DISPLAY}}`, and the reasoning behind each, because a
rule whose reason is unknown gets "fixed" the first time it is inconvenient.

The platform handles personal and official data. Treat everything in this
repository as if it will be read by someone who is not friendly.

---

## 1. Trust boundaries

```
                    ┌──────────────────────────────────────────┐
  Untrusted         │  Browser                                  │
  ────────────────▶ │  user input, URL, headers, devtools,     │
                    │  anything in localStorage                 │
                    └───────────────────┬──────────────────────┘
                                        │  the browser is the user's machine
                    ┌───────────────────▼──────────────────────┐
  Trust boundary    │  Shell — session, navigation, role guard │  defence in depth
                    └───────────────────┬──────────────────────┘
                    ┌───────────────────▼──────────────────────┐
  Trust boundary    │  Backend API — validates token AND role  │  THE boundary
                    └──────────────────────────────────────────┘
```

**Everything in the browser is untrusted, including our own frontend code.** A
frontend repository is distributed source. Anyone can read it, patch it, and call
the API directly.

Therefore: **the Shell's role guard is user experience, and the API is security.**
A module that treats navigation as authorization has no access control.

---

## 2. Authentication

| Rule | Why |
| --- | --- |
| Keycloak is initialised once, in the Shell | Two clients means two refresh schedules; one will fail in production |
| A module obtains credentials through the host adapter | Keeps one session model to maintain |
| No client secret in a frontend repository | A frontend bundle is public. The secret is published. |
| No token in module-local storage | Storage is readable by any script on the origin |
| `VUE_APP_SKIP_ROLE_CHECK` is local-only, never deployed | It disables the role guard entirely |

Details: `03-architecture/AUTHENTICATION.md`.

---

## 3. Authorization

Every endpoint must independently verify:

1. The bearer token is present, valid, unexpired, and for the right issuer and
   audience.
2. The caller's roles include the role this endpoint requires.
3. The resource belongs to that caller or tenant — object-level authorization,
   not just role-level.

| Anti-pattern | Why it fails |
| --- | --- |
| "The Shell already checked the role" | The Shell is not the security boundary |
| "The menu does not show it to them" | The menu is a browser-side fixture or a UI hint, not a control |
| "The token contains the role, so it is fine" | A valid token does not mean *this* role for *this* resource |
| Checking the role from a header the client sets | The client sets it to whatever it wants |
| Only checking on write, not on read | Reads leak the same data |

---

## 4. Input handling

- **Validate on the server, always.** Client-side validation is an affordance
  for the user, never a control.
- **Never build a URL by concatenating user input.** A missing base produces
  `undefined/kategori-program` and a 404 from an unexpected host; an unsanitised
  one produces a request to somewhere else entirely.
- **Never render user input as HTML** without sanitising. Use
  `textContent`, or the framework's escaping, or an explicit sanitiser.
- **Escape every value that reaches a log line, an error message, or a URL.**
  A newline in a header is header injection; an unescaped string in a log is log
  forgery.
- **Bound everything.** Page size, upload size, string length, array length,
  recursion depth. Unbounded input is a denial-of-service vector.

---

## 5. Secrets

| Never | Where secrets belong |
| --- | --- |
| In `.env` committed to git | A secret manager, or untracked local `.env` |
| In source, as a literal | The environment, at build time |
| In a frontend bundle | Nowhere. It ships to every user. |
| In a comment, a test fixture, or a screenshot | Nowhere |
| In a URL query string | It lands in access logs and browser history |

If a secret is committed, it is compromised. Rotating it is the only remedy;
removing it from history is hygiene, not a fix.

Scan before every release: `06-quality/CHECK.md` §3.

---

## 6. Data protection

This platform processes Malaysian public-sector and official data.

| Rule | Detail |
| --- | --- |
| Minimise | Fetch and display only the fields the view needs |
| Do not log personal data | No names, IC numbers, addresses, phone numbers in logs or errors |
| Do not send to third parties | No analytics, no error tracker, no CDN, without a documented decision here |
| Do not persist in the browser | Beyond the session envelope the Shell already uses |
| Do not cache sensitive responses | In memory, `localStorage`, or a service worker |
| Respect retention | Deletion must reach derived copies, exports and audit records |

Any exception is a line in this document, with a reason and an approver.

---

## 7. Dependencies

- Only packages in `05-development/TOOLS.md`.
- No postinstall scripts from a new dependency without review — a `postinstall`
  runs with your user's permissions.
- No `http://` source. No repository outside the approved list.
- Review a dependency's transitive count before adding it. A small-looking
  utility that pulls 200 packages is a supply-chain decision.
- `@2enapps/ui` is fetched from a branch. Branch installs do not produce an
  immutable reference until the lockfile records the resolved commit — commit the
  lockfile with every update. See `07-delivery/SYNC.md`.

---

## 8. Cross-origin

The remote and the Shell are different origins in development and often in
deployment.

- `Access-Control-Allow-Origin` on the remote must be the **exact** Shell
  origin, including the port. A wildcard with credentials is invalid and unsafe.
- Never reflect an arbitrary `Origin` header back in the allow header.
- `Access-Control-Allow-Credentials: true` requires a specific origin, not `*`.
- The API must allow the Shell's origin, not the module's dev server, unless it
  is genuinely the caller's origin.

See `06-quality/DEBUG.md` for the exact symptoms of a CORS mismatch.

---

## 9. Frontend-specific risks

| Risk | Control |
| --- | --- |
| `v-html` with unsanitised input | Never, or sanitise explicitly with a documented library |
| Token in `localStorage` | Read credentials through the host adapter only |
| `target="_blank"` without `rel="noopener"` | Add it. The new page gets a handle on this one. |
| Third-party script without `integrity` | Add a subresource integrity hash, or do not load it |
| Source maps published to production | `productionSourceMap: false` in `vue.config.js` |
| `postMessage` without an origin check | Always check `event.origin` |

`productionSourceMap: false` is set in this repository's build configuration.
It stays that way; source maps go to an error tracker, not to the static host.

---

## 10. Reporting a vulnerability

1. Do not open a public issue. Do not commit a proof of concept to a public
   branch.
2. Notify {{SECURITY_CONTACT}} privately.
3. Include: what, where, how to reproduce, and the impact you observed. Not a
   theoretical impact — the observed one.
4. Wait for a fix before disclosure, unless there is active harm. Active harm
   escalates immediately.

---

## 11. Security checklist

Run before every release. Full procedure in `06-quality/CHECK.md` §3.

- [ ] No secret, key, token or client secret in the diff or the history
- [ ] No `.env` committed; `.env.example` has the new keys, values empty
- [ ] No new dependency outside `05-development/TOOLS.md`; no postinstall script
- [ ] No new endpoint without server-side token and role validation
- [ ] No personal data in a log, an error message, or a third-party call
- [ ] No `v-html` on unsanitised input; no `target="_blank"` without `rel`
- [ ] `VUE_APP_SKIP_ROLE_CHECK` absent from every deployed configuration
- [ ] CORS allows the exact Shell origin, never a reflected `Origin`
- [ ] `productionSourceMap: false`
- [ ] Every input the user controls is bounded and validated server-side

---

## 12. Decisions log

Security decisions that deviate from the default, and the reasoning.

| Date | Decision | Reason | Approver | Review by |
| --- | --- | --- | --- | --- |
| | | | | |
