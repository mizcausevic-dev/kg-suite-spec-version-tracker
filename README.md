# kg-suite-spec-version-tracker

[![CI](https://github.com/mizcausevic-dev/kg-suite-spec-version-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/mizcausevic-dev/kg-suite-spec-version-tracker/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)

Walk a mixed-protocol directory of [Kinetic Gain Suite](https://suite.kineticgain.com/) JSON documents and surface **spec-version drift** per protocol.

If your fleet has some AgentCards on `agent_card_version: 0.1` and others on `0.2`, or some prompts on `provenance_version: 0.1` and others on a future `0.2`, this tool tells you exactly which files are on which version so you can plan the migration.

Composes [`kg-protocol-detect`](https://github.com/mizcausevic-dev/kg-protocol-detect) (routing) with version-distribution accounting.

---

## What it routes

Each `*.json` file in `<dir>` is classified as one of:

- `agent-cards-spec`
- `mcp-tool-card-spec`
- `prompt-provenance-spec`
- `evidence-bundle-spec`
- `otel-genai-otlp`
- `mcp-tools-list`
- `unknown`

Then grouped by `(protocol, spec_version)` and reported.

## What it flags

| Code | Severity | Rule |
|---|---|---|
| `version-drift` | 🟠 | One protocol has ≥ 2 distinct spec versions in use (e.g., agent-cards-spec v0.1 + v0.2 mixed). |
| `low-confidence-routing` | 🟡 | A doc was routed by shape signals only (no version discriminator) — the verdict is best-effort. |
| `unknown-protocol-document` | 🟡 | A JSON file in the dir didn't match any known Suite spec. |
| `no-version-discriminator` | ℹ️ | A doc has no explicit `*_version` field (only triggers on protocols where versioning is expected). |

No high-severity findings — drift is informational and won't fail your build by default. Pass `--fail-on-drift` to exit `1` when any drift is detected.

## CLI

```
npx kg-suite-spec-version-tracker <mixed-protocol-dir>
    [--format json|markdown|summary]
    [--now <iso>] [--fail-on-drift] [--out FILE]
```

Exit codes:

- `0` — no drift (or `--fail-on-drift` not set)
- `1` — drift found AND `--fail-on-drift` set
- `2` — usage / I/O error

## Library

```ts
import { track, toMarkdown } from "kg-suite-spec-version-tracker";

const files = [
  { path: "card-a.json", doc: { agent_card_version: "0.1", /* ... */ } },
  { path: "card-b.json", doc: { agent_card_version: "0.2", /* ... */ } }
];
const report = track(files);
console.log(report.buckets);   // grouped by (protocol, version)
console.log(report.findings);
console.log(toMarkdown(report));
```

## Composes with

- [**`kg-protocol-detect`**](https://github.com/mizcausevic-dev/kg-protocol-detect) — vendored as the routing primitive.
- [**`kg-suite-conformance-runner`**](https://github.com/mizcausevic-dev/kg-suite-conformance-runner) — sibling fleet tool that validates required top-level blocks per spec.
- [**`agent-card-fleet-summary`**](https://github.com/mizcausevic-dev/agent-card-fleet-summary), [**`mcp-tool-card-fleet-summary`**](https://github.com/mizcausevic-dev/mcp-tool-card-fleet-summary), [**`prompt-provenance-fleet-summary`**](https://github.com/mizcausevic-dev/prompt-provenance-fleet-summary), [**`evidence-bundle-fleet-summary`**](https://github.com/mizcausevic-dev/evidence-bundle-fleet-summary) — per-protocol fleet analyzers.

## License

[AGPL-3.0-or-later](LICENSE)
