# Changelog

All notable changes to this repository. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html) — see
`.docs/project-governance/07-delivery/VERSIONING.md`.

## [Unreleased]

Nothing yet. The first entry is written when the first change is released, in
this shape:

```markdown
## [1.1.0] — 2026-01-31

### Added
- One line describing what a user can now do that they could not before.

### Changed
- One line describing behaviour that differs, and why it was worth it.

### Fixed
- One line naming the defect, not the fix.
```

## [{{MODULE_VERSION}}] — {{INSTALL_DATE}}

### Added
- The {{MODULE_DISPLAY}} service, scaffolded from the D-ReAMS governance
  templates: Controller → Service → `DocumentStorage` → `MinioStorageService`,
  with a `.env` of its own, Spotless, Checkstyle and SpotBugs in the build.
- The generated API table in `README.md`, read from the controller annotations.

### Notes
- The bucket is `{{BUCKET}}` and belongs to this module alone. See
  `.docs/project-governance/09-backend/STORAGE.md`.
