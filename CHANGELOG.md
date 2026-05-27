# Changelog

## v0.1.0 — 2026-05-26

- Initial release: `track(files, opts?)` → `FleetVersionReport` with per-`(protocol, spec_version)` accumulation across a mixed-protocol directory.
- Routes each document via a vendored copy of `kg-protocol-detect` — same 6 protocol ids + `unknown`.
- 4 finding codes: `version-drift` (medium, ≥ 2 distinct spec versions for one protocol), `low-confidence-routing` (low), `unknown-protocol-document` (low), `no-version-discriminator` (info).
- Formatters: `toMarkdown(report)` (per-protocol table + findings) and `toSummary(report)`.
- CLI: `kg-suite-spec-version-tracker <dir>` with `--format json|markdown|summary`, `--now <iso>`, `--fail-on-drift`, `--out FILE`.
- 9-document mixed fixture corpus covering every protocol + a deliberate v0.1/v0.2 drift on agent-cards-spec.
- Composes with `kg-protocol-detect`, `kg-suite-conformance-runner`, and the per-protocol fleet-summary tools.
- Node 20/22 CI (lint, typecheck, coverage, build, demo, `npm audit`), AGPL-3.0-or-later, Dependabot.
