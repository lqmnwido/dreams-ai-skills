<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# API CONTRACT — {{MODULE_NAME}}

The boundary between `{{MODULE_NAME}}` and the backend services it calls:
{{API_BASES_LIST}}

The frontend and the backend live in **separate repositories** and are deployed
independently. This document is the only thing they share. A change to an
endpoint shape made in one repository and not the other is a production incident
waiting for a user to find it.

**The rule: if it is not in this document, nobody knows its shape. Do not call
it. Ask, write it here, then call it.**

---

## 1. Contract rules

1. **One owner per endpoint.** The backend owns the shape. The frontend adapts.
2. **Additive changes only, within a major version.** A new optional field is
   fine. A removed field, a renamed field, or a changed type is a major version.
3. **Version in the path or the header, not in a query parameter.** A version that
   can be forgotten is not a version.
4. **The deprecation window is at least one minor release of every consumer.**
5. **The contract is tested.** A contract test runs in CI on both sides.
6. **Errors are part of the contract**, not an afterthought. See §5.

---

## 2. Services consumed

| Service | Base variable | Base URL (dev) | Owner | Version | Contract test |
| --- | --- | --- | --- | --- | --- |
| {{API_SERVICE_1}} | `{{API_BASES}}` | | | v1 | |
| {{API_SERVICE_2}} | | | | | |
| {{API_SERVICE_3}} | | | | | |

---

## 3. Endpoints

### 3.1 `{{ENDPOINT_GROUP_1}}`

```http
GET {{API_BASE}}/{{ENDPOINT_PATH}}
Authorization: Bearer <token>
```

| | |
| --- | --- |
| **Purpose** | |
| **Auth** | role `{{ROLE_KEY}}` or narrower |
| **Rate limit** | |
| **Timeout** | |
| **Idempotent** | yes / no |
| **Added in** | v{{API_VERSION}} |
| **Changed in** | |

**Query parameters**

| Name | Type | Required | Notes |
| --- | --- | --- | --- |
| | | | |

**Response `200`**

```json
{
  "data": [],
  "totalItems": 0
}
```

| Field | Type | Nullable | Notes |
| --- | --- | --- | --- |
| `data` | array | no | |
| `totalItems` | integer | no | total across all pages, not this page |

**Frontend consumer**

`src/services/{{MODULE_NAME}}/{{SERVICE_FILE}}` → `{{FUNCTION_NAME}}()`

---

## 4. Response envelope

The services this platform calls use a common shape, and the module's transport
layer reproduces it deliberately because the backend depends on it.

```json
{
  "data": <payload>,
  "totalItems": <integer>     // list responses only
}
```

The module's helpers unwrap it:

| Helper | Effect |
| --- | --- |
| `returnResponseList()` | sets `res.list` from `data.data ?? data`, and `res.total` from `totalItems` |
| `returnResponseDetails()` | passes through |
| `returnResponsePost()` | writes an audit record, strips upload URLs from the payload, returns `res.data` |
| `returnResponsePut()` | as POST, typed `UPDATE` |
| `returnResponseDelete()` | writes an audit record, returns `res.data` |

**Every write goes through one of these helpers.** They carry the audit trail
(`setAuditTrails`) and the post-save upload cleanup. A hand-rolled `await
client.post(...)` skips the audit record, and that is a compliance defect, not a
style issue.

### Transport rules

Two behaviours are reproduced deliberately, because the backend depends on them:

1. `/public/` is prefixed onto the path **unless** the request carries an `authId`
   header.
2. `authId` is mirrored into the query string, unconditionally for the ASR, VTT
   and KOD clients.

This looks wrong. It is not negotiable from the frontend side. If it needs to
change, it changes in the backend and in every consumer at once — a Change
Request, and a version bump.

---

## 5. Errors

| Status | Meaning | Frontend behaviour |
| --- | --- | --- |
| `400` | Validation failed | Show field errors; do not retry |
| `401` | Missing, invalid or expired token | Trigger re-authentication via the host; do not retry the same token |
| `403` | Authenticated but not permitted | Show the access-denied state; never retry |
| `404` | Not found, or not visible to this caller | Show an empty state; never distinguish from "forbidden" in the UI |
| `409` | Conflict | Show the conflict; offer reload |
| `422` | Semantically invalid | Show the message |
| `429` | Rate limited | Back off; honour `Retry-After` |
| `500` | Server error | Show a generic error; log the correlation id, not the payload |
| `503` | Upstream unavailable | Retry with backoff; surface degraded state after N attempts |

Error body:

```json
{
  "message": "human-readable",
  "error": "machine-readable code",
  "fields": { "fieldName": "why it is wrong" }
}
```

**Never show a raw `message` from an unknown service to a user.** It may contain
internal identifiers, another user's data, or a stack fragment. Map known codes
to a localised string and show a generic message otherwise.

### Retries

| Method | Automatic retry |
| --- | --- |
| `GET` | Yes, bounded, with backoff, on network error / `5xx` / `429` |
| `POST` | **No**, unless the endpoint is explicitly idempotent by design |
| `PUT` | No, by default |
| `DELETE` | **Never** |

A retried `POST` creates duplicate records. This has happened.

---

## 6. Uploads

| Rule | Detail |
| --- | --- |
| Content type | Validated on the server. The client check is an affordance. |
| Size limit | Enforced server-side; the client refuses early with the same number |
| Naming | Client-generated name, server-assigned storage key |
| Progress | Shown for uploads over {{UPLOAD_THRESHOLD}} |
| Failure | Partial uploads are cleaned up; the UI states it is retryable |
| Post-save | Upload URLs are removed from the payload after a successful write, so a later save does not re-upload |

---

## 7. Contract tests

A contract test asserts that the frontend's assumption about a response still
holds. It runs in CI, against a recorded or stubbed response.

```js
// tests/contract/program.contract.test.js
it("returns a list envelope with a total", async () => {
  const res = await fetchPrograms({ kategori: "latihan" });

  expect(Array.isArray(res.list)).toBe(true);
  expect(typeof res.total).toBe("number");
  // Any new required field the backend adds is a breaking change unless this
  // test is updated deliberately in the same commit as the API change.
});
```

Contract tests are not unit tests with a mock. A mock tests what the frontend
*believes*. A contract test pins what the backend actually returns, or what has
been explicitly agreed in this document.

---

## 8. Adding or changing an endpoint

1. Open a Change Request. `01-product/CHANGE-REQUEST.md`.
2. Confirm the endpoint's owner. This repository does not own backend behaviour.
3. Write the contract **here first**, including the error responses.
4. Implement the service function, using the module's transport and response
   helpers.
5. Add the contract test.
6. Add the env var to `.env.example` **and** `.env`, and to §6 of
   `05-development/DEVELOPMENT.md`.
7. Add the audit call, if it is a write.
8. Verify the negative cases: no token, wrong role, malformed body.

---

## 9. Change log

| Date | Endpoint | Change | Type | Consumers notified | Version |
| --- | --- | --- | --- | --- | --- |
| | | | additive / breaking | | |
