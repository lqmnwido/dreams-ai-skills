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
- The `{{MODULE_NAME}}` Module Federation remote, scaffolded from the D-ReAMS
  governance templates: expose keys, metadata, the standalone preview entry and
  one view per sub-module.
- The generated routes table in `README.md`, read from the expose keys in
  `vue.config.js`.

### Notes
- The Shell owns bootstrap, authentication, navigation and the role check. This
  repository owns its views, its services and its own environment — see
  `.docs/project-governance/03-architecture/ARCHITECTURE.md`.
