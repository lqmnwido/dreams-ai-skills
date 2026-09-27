<!-- managed-by: @lqmnwido/dreams-ai-skills -->

# STORAGE — {{MODULE_NAME}}

Object storage for uploaded documents: MinIO locally, one bucket per module,
and the rules that keep one module out of another's files.

---

## 1. One module, one bucket

| | |
| --- | --- |
| Bucket | `{{BUCKET}}` |
| Derived from | the module slug (`--slug`), never typed |
| Endpoint | `{{MINIO_ENDPOINT}}` (local) |
| Console | `{{MINIO_CONSOLE}}` |
| Client | `{{BACKEND_REPO}}` — the frontend never talks to MinIO directly |

The bucket name is generated from the module slug for the same reason the Java
package is: a bucket called `module-demo` and a service configured for
`module_demo` is a mismatch that only appears at upload time, in production, in
someone else's logs.

Two locks enforce ownership:

1. **The bucket.** MinIO credentials are shared locally, so the bucket alone
   would not stop a bug.
2. **The key prefix.** Every object this module writes starts with
   `{{MODULE_SLUG}}/documents/`, and `DocumentService.requireOwnedKey` refuses
   any key that does not. A guessed or mis-routed key fails before it reaches
   the storage client.

---

## 2. Local setup

The installer checks for MinIO and offers to start it:

```bash
npx -y @lqmnwido/dreams-ai-skills --minio=install
```

| `--minio=` | Behaviour |
| --- | --- |
| `auto` (default) | Detect. If absent, ask in a terminal. In a non-interactive run, print the commands and do nothing |
| `install` | Start MinIO in Docker and create `{{BUCKET}}` — explicit consent, usable from a script |
| `check` | Report status only |
| `skip` | Do not look |

A non-interactive run never installs anything. A pipeline cannot grant
permission on anyone's behalf, so it prints instead of acting.

What the installer does:

1. Probes `{{MINIO_ENDPOINT}}/minio/health/live`. This is the only signal that
   matters — a container that exists but is stopped stores nothing.
2. If unreachable and consented to, starts `dreams-minio` in Docker:
   ports `9000`/`9001`, data in `~/.dreams/minio-data`, credentials from
   `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` (default `minioadmin`).
3. Waits for health, then issues a signed `PUT /{{BUCKET}}` to create the
   bucket. Idempotent — an existing bucket is reported, not recreated.

The data directory lives **outside** the repository on purpose: a data directory
inside a git working tree either ends up committed or ends up in `.gitignore`
and then lost between machines.

### 2.1 By hand

```bash
docker run -d --name dreams-minio \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  -v "$HOME/.dreams/minio-data:/data" minio/minio:latest \
  server /data --console-address ":9001"
```

The bucket must be created with `minio/mc`, which is a **different image** from
the server:

```bash
docker run --rm --network host \
  -e MC_HOST_local=http://minioadmin:minioadmin@127.0.0.1:9000 \
  minio/mc mb --ignore-existing local/{{BUCKET}}
```

---

## 3. How the service connects

`.env` in `{{BACKEND_REPO}}` — not the Shell's, not the frontend's:

| Key | Value | Read by |
| --- | --- | --- |
| `MINIO_ENDPOINT` | `{{MINIO_ENDPOINT}}` | `StorageConfiguration` → `MinioClient` |
| `MINIO_ROOT_USER` | local access key | same |
| `MINIO_ROOT_PASSWORD` | local secret key | same |
| `MINIO_BUCKET` | `{{BUCKET}}` | `StorageProperties.requireBucket()` |
| `MINIO_REGION` | `us-east-1` | presigned URL signing |

`application.yml` reads them as `${MINIO_BUCKET:{{BUCKET}}}` — a default, so a
missing key still starts the service and fails loudly at the first write rather
than silently at boot.

`storage.bucket` may never be blank. `requireBucket()` throws instead of
returning `""`, because a write to a blank bucket name fails deep inside the S3
client with a message naming neither the module nor the file.

**The frontend never contacts MinIO.** Uploads go to
`POST /api/{{MODULE_SLUG}}/documents` on this module's own service; the service
returns a presigned URL; the browser downloads from that URL. Putting MinIO
credentials in a frontend `.env` would publish them in the bundle.

---

## 4. The upload feature

| Method | Endpoint | Handler |
| --- | --- | --- |
| `POST` | `/api/{{MODULE_SLUG}}/documents` | `DocumentController.upload` |
| `GET` | `/api/{{MODULE_SLUG}}/documents/{key}` | `DocumentController.resolve` — 302 to a presigned URL |
| `DELETE` | `/api/{{MODULE_SLUG}}/documents/{key}` | `DocumentController.remove` |

- **Upload** is `multipart/form-data`, part name `file`. `201` with the key,
  size, type and a one-hour download location.
- **Download** is a redirect, so the bytes come straight from object storage
  and never pass through the JVM.
- **Size** is bounded by `MAX_FILE_SIZE` (default `25MB`); exceeding it is
  `413`, not `500` — the limit is the caller's problem to respect.
- **Filenames** are sanitised, not trusted: letters, digits, `.`, `-`, `_`
  (Unicode letters survive), path separators dropped, and a UUID is placed
  between the prefix and the filename so two uploads of `report.pdf` coexist.

The generated README table at the top of `{{BACKEND_REPO}}/README.md` is read
from these annotations. An endpoint added without re-running the installer
leaves that table stale — and a stale table is a contract nobody owns.

---

## 5. Finding upload features already in the repository

```bash
npx -y @lqmnwido/dreams-ai-skills --check
```

The check reports, with file and line:

| Signal | Meaning |
| --- | --- |
| `MultipartFile`, `@RequestPart` | a backend upload endpoint exists |
| `multipart/form-data`, `type="file"`, `new FormData(` | a frontend upload path exists |
| `io.minio`, `PutObjectArgs`, `presignedObjectUrl` | object storage is used |
| `MINIO_BUCKET` / `bucket:` | a bucket is configured — and which one |

Two combinations are reported as problems:

- **An upload path with no object-storage client.** The feature exists and
  nothing receives the bytes — or the bytes go somewhere undocumented.
- **Storage configured with no upload path.** A dependency nobody uses.

A bucket found in configuration but different from `{{BUCKET}}` is worth
investigating: either the module was renamed, or two modules share storage.

---

## 6. Failure modes

| Symptom | Likely cause | First thing to check |
| --- | --- | --- |
| `502 object storage is unavailable` on upload | MinIO not running, wrong endpoint, bad credentials | `curl {{MINIO_ENDPOINT}}/minio/health/live` |
| `storage.bucket is not set` | `.env` missing or not loaded | `ls {{BACKEND_REPO}}/.env`, then the service log at startup |
| `413` on upload | file over `MAX_FILE_SIZE` | the limit, not the client |
| `400 that document does not belong to this module` | key from another module, or a hand-edited key | the key prefix — §1 |
| `400 the document key is not well formed` | traversal attempt or a malformed key | who produced the key |
| `403` from bucket creation | credentials differ from the running server | `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` |

Nothing here retries automatically. A retry loop on a write that may or may not
have landed is how duplicate documents appear; the caller decides whether to
retry, and `08-operations/INCIDENT.md` records the incident.

---

## 7. Beyond the laptop

The scaffold is local-first, and that is deliberate — a fresh checkout must
build and test with no object store running. Before this module reaches a real
environment:

1. Point `MINIO_ENDPOINT` at the platform's object store. The value comes from
   the environment, never from a committed file.
2. Rotate the credentials. `minioadmin`/`minioadmin` is a development default
   and nothing else.
3. Decide the presigned TTL (`PRESIGN_TTL_SECONDS`, currently one hour) against
   the platform's document-retention rules.
4. Confirm the bucket policy denies cross-module access, not just this module's
   own code.

Each of those is a Change Request against `01-product/CHANGE-REQUEST.md`, not an
edit made in passing.

---

*See also: `09-backend/SPRING-BOOT.md` for the adapter that owns these calls,
`06-quality/CHECK.md` for the checks above, `08-operations/MONITORING.md` for
what to alert on, and `02-governance/SECURITY.md` for upload validation rules.*
