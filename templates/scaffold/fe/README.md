# {{MODULE_DISPLAY}} — frontend

<!-- managed-by: @lqmnwido/dreams-ai-skills -->

{{MODULE_DISPLAY}} is a Module Federation remote for the D-ReAMS platform. It
owns its feature views, its feature services and its preview entry. The Shell
owns application bootstrap, Keycloak authentication, navigation, menu retrieval,
role checks and the authenticated host bridge. Shared presentation components
live in `@2enapps/ui`.

## Routes

The Shell mounts pages from this module's expose keys. Each row below is one
page: the route the Shell registers, the route `name` it uses, and the view file
this repository serves it from. An expose key and its Shell `import()` must match
byte for byte apart from the leading `./` — see
`.docs/project-governance/03-architecture/ARCHITECTURE.md` §3.2.

__ROUTES_BLOCK__

## Module identity

| Value | Source |
| --- | --- |
| Federation name | `name` in `vue.config.js` → `{{MODULE_NAME}}` |
| Route prefix | `{{ROUTE_PREFIX}}` |
| Role id | `{{ROLE_KEY}}` |
| Local port | `{{REMOTE_PORT}}` |
| Bucket | `{{BUCKET}}` (created in MinIO, used by this module's backend) |

## Environment

This repository has its own environment. Copy `.env.example` to `.env` and
restart after any change — the Shell's `.env` is not visible to a remote.

| Key | Purpose |
| --- | --- |
| `{{API_BASE_ENV}}` | This module's own backend service |
| `VUE_APP_{{MODULE_PASCAL_UPPER}}` | This module's own dev server origin |
| `VUE_APP_SHELL` | The Shell origin used for CORS and the remote entry |

## Commands

```bash
npm install
npm run serve           # dev server on {{REMOTE_PORT}}
npm run verify          # prettier --check, then eslint
```

## Repository map

```
src/
├── remote-entry.js          federation entry (empty; exposes are declared in vue.config.js)
├── metadata.js              {{MODULE_NAME}}_METADATA — remote name, route prefix, version
├── preview/                 standalone development without the Shell
├── views/                   one file per exposed page
└── services/{{MODULE_SNAKE}}/  this module's transport layer
```

__INVENTORY__
