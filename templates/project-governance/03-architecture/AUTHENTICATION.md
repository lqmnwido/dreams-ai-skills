<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# AUTHENTICATION & AUTHORIZATION — {{MODULE_NAME}}

Who the user is, what they may do, and where each of those is decided.

The short version: **the Shell owns identity, the backend owns permission, and
this module owns neither.** This document explains the mechanism and, more
importantly, why each piece sits where it does.

---

## 1. Division of responsibility

| Concern | Decided by | Enforced in | Module's role |
| --- | --- | --- | --- |
| Authentication — who is this | Keycloak, via the Shell | `shell/src/auth/keycloak.js` | Read credentials through the host adapter |
| Session lifetime, refresh | Keycloak, via the Shell | the adapter | Never construct a second client |
| Navigation — may they see the menu | Shell, from the server menu tree | `shell/src/services/menu.js` | Contribute its own offline fixture |
| Navigation — may they open the route | Shell role guard | `shell/src/router/` | Declare `meta.roles` in the Shell route |
| **Authorization — may they do it** | **The backend** | **every endpoint** | **Call it. Do not second-guess it.** |

The last row is the one that matters. The two above it are user experience. The
browser is the user's machine; anything enforced only there is a suggestion.

---

## 2. Authentication

### 2.1 The flow

```
Browser ──▶ Keycloak (OIDC authorization code + PKCE)
              │  tokens
              ▼
           Shell ──▶ auth adapter ──▶ host adapter ──▶ @2enapps/ui
                          │                  │
                          └──────────────────┴──▶ {{MODULE_NAME}} services
                                              (getAuthHeaders())
```

The Shell initialises Keycloak **once**, at bootstrap, before the adapter is
installed. A module never calls `kc.init()`.

### 2.2 How a module gets credentials

Through the host adapter, which the Shell provides:

```js
import { useHostAdapter } from "@2enapps/ui";

const adapter = useHostAdapter();
const authHeaders = adapter.getAuthHeaders
  ? await adapter.getAuthHeaders()
  : {};
```

Every request in this module's transport goes through exactly this path
(`src/services/{{MODULE_NAME}}/http.js`). It builds the URL, merges the headers,
and never touches a token store directly.

**If a service function in this repository reads `localStorage` for a credential,
it is a defect.** Not a style issue — it is a second session model that will
diverge.

### 2.3 Roles

A user's role ids are derived from the menu tree the API returns. The Shell
resolves the current user's menu and extracts the role ids, and the router guard
compares them against `meta.roles`.

For this module, the role is `{{ROLE_KEY}}`:

| Where | What |
| --- | --- |
| Shell route `meta.roles` | `["{{ROLE_KEY}}"]` |
| Menu fixture `listRole[].id` | `{{ROLE_KEY}}` |
| Server-side menu source | the role granting the menu entry |
| Every backend endpoint | the same role checked server-side |

**All four must agree.** Any one of them differing produces one of these
symptoms:

| Mismatch | Symptom |
| --- | --- |
| Route has no role, menu does | A user sees a menu entry and gets a 403 on click |
| Menu has no role, route does | A permitted user cannot find the module |
| Both have it, API does not | A permitted user is denied at the last step, with a UI that says "allowed" |
| Route is `authRequired: false` | The page is reachable by an unauthenticated visitor, and every request it makes 401s |

### 2.4 The role guard is not the boundary

```js
// This is a navigation control.
{ path: "...", meta: { authRequired: true, roles: ["{{ROLE_KEY}}"] } }
```

It decides whether `vue-router` renders the component. It cannot decide whether
an endpoint executes, because anyone can open the network tab and call the
endpoint with any token they have — or none.

The Shell's guard is defence in depth. It is a good one. It is not security.

---

## 3. Authorization in the backend

Every endpoint must verify, independently:

1. **Token** — present, signature valid, not expired, correct issuer and audience.
2. **Role** — the caller's roles include what this endpoint requires.
3. **Object** — the resource belongs to the caller's organisation or tenant.

The third is the one that is usually missing. Role-level checks alone leak data
between tenants: a user in organisation A who guesses a record id in organisation
B is authorised, because their role is correct.

### Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| "The Shell already checked the role" | The Shell is not the security boundary |
| "The menu does not show it to them" | The menu is a UI hint and a local fixture |
| "The token has a role claim, so it's fine" | A valid token is not authorization for *this* resource |
| Reading the role from a client-set header | The client sets it to whatever it wants |
| Checking writes but not reads | Reads leak the same data |
| `VUE_APP_SKIP_ROLE_CHECK=1` in production | Disables the role guard entirely |

---

## 4. Session storage

| What | Where | Why |
| --- | --- | --- |
| Access/refresh token | Keycloak's own storage, via the Shell | Not this module's business |
| User profile | `localStorage.user` envelope, written by the Shell | Read-only for this module |
| Module UI state | A Pinia store, or component state | Cleared on unmount or on a key |
| A credential | Nowhere in this module | See §2.2 |

**Never** put a token, a password, or an `authId` into a module-local storage
key. Storage is readable by any script on the origin, and persists after logout
unless something clears it.

The `localStorage.user` envelope is written by the Shell and may be encrypted
with AES when `VUE_APP_ENCRYPT_LS=1`. The key is a build-time secret supplied
through the environment. It is never committed, and this module never reads it
directly.

---

## 5. Service-to-service and machine identity

A browser token is for a human-present session. Anything unattended — a scheduled
job, a webhook consumer, a batch import — needs a different identity.

| Rule | Detail |
| --- | --- |
| No shared secret in a frontend repository | A frontend bundle is public |
| No long-lived token in a browser | It outlives the session that created it |
| Machine identities live server-side | In the backend's own secret management |
| Audit records carry the acting user | From the server-side token, not from a client field |

---

## 6. Authorization and the audit trail

The module's response helpers write an audit record for every write, using the
naming rules the backend expects:

| Field | Source |
| --- | --- |
| `namaModul` | Derived from which API base the URL belongs to |
| `namaProses` | Derived from the URL and the transaction type, or passed explicitly |
| `urlApi` | The full request URL |
| `kandonganJson` | The payload, except for login and print-format calls |
| `idPengguna`, `namaPengguna` | The acting user, from the support-user store or the session |
| `alamatIp` | The caller's address |
| `jenisTransaksi` | `INSERT` / `UPDATE` / `DELETE` / `UPLOAD` / `LOGIN` |

**A write that bypasses these helpers has no audit record.** That is a compliance
defect, not an oversight. Use `returnResponsePost()`, `returnResponsePut()` and
`returnResponseDelete()`.

Never log a token, a password, a full `Authorization` header, or personal data
in the audit payload.

---

## 7. Verification

Run these before handing the module over. Each is a real request, not a code
read.

| # | Check | Expected |
| --- | --- | --- |
| 1 | Open the module route with no session | redirected to login, or `403` — never a rendered page |
| 2 | Open it with a session that lacks `{{ROLE_KEY}}` | `/forbidden` |
| 3 | Open it with a session holding `{{ROLE_KEY}}` | the module renders |
| 4 | Call a module endpoint with no `Authorization` header | `401` |
| 5 | Call it with a valid token for the wrong role | `403` |
| 6 | Call it with a valid token for the right role | `200` |
| 7 | Call it for a record in another tenant | `403` or `404` — never the record |
| 8 | Perform a write | an audit record exists with the acting user |
| 9 | Search the bundle for a token or secret | no hits |
| 10 | Grep the deployed env for `VUE_APP_SKIP_ROLE_CHECK` | absent |

Checks 4–7 are the security boundary. Run them against the API directly with
`curl` or the browser network panel — **not** through the UI, because the UI's
guard would mask the result.

---

## 8. Auth-related environment

Configured in the Shell. This module must not define them.

| Variable | Owner | Note |
| --- | --- | --- |
| `VUE_APP_KEYCLOAK` | Shell | switches auth source |
| `VUE_APP_KEYCLOAK_URL` | Shell | |
| `VUE_APP_KEYCLOAK_REALM` | Shell | |
| `VUE_APP_KEYCLOAK_CLIENT_ID` | Shell | a **public** client id, never a secret |
| `VUE_APP_SKIP_ROLE_CHECK` | local only | must be absent from every deployed environment |
| `VUE_APP_ENCRYPT_LS`, `VUE_APP_ENCRYPT_LS_KEY` | Shell | the storage envelope |

---

## 9. Change checklist

Any change to authentication or authorization in this module:

- [ ] No new Keycloak client, no client secret, no token read outside the adapter
- [ ] `meta.roles` in the Shell route still matches `listRole[].id` and the
      backend's required role
- [ ] The menu entry exists in the **server-side** source, not only the fixture
- [ ] The negative cases were tested against the API directly
- [ ] Audit records are written for every new write
- [ ] `02-governance/SECURITY.md` and this document were updated
