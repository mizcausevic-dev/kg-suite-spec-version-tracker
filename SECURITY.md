# Security Policy

`kg-suite-spec-version-tracker` is a pure-transform library and CLI: it reads JSON files from a directory and emits a structured version-distribution report. No network listener, no remote fetch, no execution of user-supplied code.

The input files may contain internal identifiers and URIs that are sensitive in your environment. The output report's `findings[].file` field includes the file paths verbatim — be deliberate about where you publish the rendered report.

## Supported versions

Only the latest tagged release is supported.

## Reporting a vulnerability

Please use GitHub Security Advisories for private disclosure:

- [Open a security advisory](https://github.com/mizcausevic-dev/kg-suite-spec-version-tracker/security/advisories/new)

Do not file public issues for security reports.
