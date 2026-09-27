# {{MODULE_DISPLAY}} — backend

<!-- managed-by: @lqmnwido/dreams-ai-skills -->

Spring Boot 3.5 on Java 21. This service is owned by the `{{MODULE_SLUG}}`
module: it reads its own environment, listens on its own port and writes to its
own MinIO bucket. It is not configured by the Shell, and it does not share
configuration with any sibling module.

## API

Every endpoint this service exposes. The table is generated from the
`@*Mapping` annotations in the controllers, so it can only disagree with the
code if it is stale — re-run `npx -y @lqmnwido/dreams-ai-skills` after adding an
endpoint.

__APIS_BLOCK__

## Configuration

Configuration comes from `.env` in this repository, loaded by
`DotEnvEnvironmentPostProcessor` as the lowest-priority property source. A real
process environment variable always wins; `application.yml` supplies the
defaults.

| Key | Default | Purpose |
| --- | --- | --- |
| `SERVER_PORT` | `{{BACKEND_PORT}}` | HTTP port |
| `MINIO_ENDPOINT` | `{{MINIO_ENDPOINT}}` | object store |
| `MINIO_BUCKET` | `{{BUCKET}}` | this module's bucket — never shared |
| `MAX_FILE_SIZE` | `25MB` | multipart limit, exceeded → 413 |

The frontend module points at this service through `{{API_BASE_ENV}}` in its own
`.env`. Neither file is read by the other repository.

## Object storage

MinIO holds uploaded documents. The installer creates the bucket:

```bash
npx -y @lqmnwido/dreams-ai-skills --minio=install
```

See `.docs/project-governance/09-backend/STORAGE.md` for the bucket rules and
for what to do when MinIO is not running locally.

## Commands

```bash
mvn spring-boot:run        # run the service
mvn spotless:apply         # fix formatting (the mechanical fix, never hand-edit)
__VERIFY_LINE__
```

`mvn verify` is the gate.
__VERIFY_CLAUSE__
The rules are in `.docs/project-governance/05-development/FORMAT-LINT.md`.

## Layout

```
src/main/java/{{PKG_PATH}}/
├── {{MODULE_CLASS}}Application.java     entry point
├── config/          .env loading, storage properties, the MinIO client bean
├── web/             response envelope and the single exception handler
├── document/        the domain: rules, port, controller
└── storage/         the S3 adapter — the only class that knows MinIO exists
```

Dependencies point inwards: `storage` knows about `document`, never the reverse.
`09-backend/SPRING-BOOT.md` is the standard this layout follows.

__INVENTORY__
