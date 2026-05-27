#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { track } from "./track.js";
import { toMarkdown, toSummary } from "./format.js";

type Format = "json" | "markdown" | "summary";

interface Args {
  dir?: string;
  format: Format;
  now?: string;
  failOnDrift: boolean;
  out?: string;
  help: boolean;
}

const FORMATS: Format[] = ["json", "markdown", "summary"];

function parseArgs(argv: string[]): Args {
  const args: Args = { format: "json", failOnDrift: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--format") {
      const v = argv[++i] as Format;
      if (!FORMATS.includes(v)) throw new Error(`--format must be one of: ${FORMATS.join(", ")}`);
      args.format = v;
    } else if (a === "--now") args.now = argv[++i];
    else if (a === "--fail-on-drift") args.failOnDrift = true;
    else if (a === "--out") args.out = argv[++i];
    else if (!a.startsWith("-")) args.dir = a;
    else throw new Error(`Unknown option: ${a}`);
  }
  return args;
}

const HELP = `kg-suite-spec-version-tracker — track Kinetic Gain Suite spec versions in use

Usage:
  kg-suite-spec-version-tracker <mixed-protocol-dir>
      [--format json|markdown|summary]
      [--now <iso>] [--fail-on-drift] [--out FILE]

Walks every *.json file in <dir>, routes each via kg-protocol-detect's logic,
groups by (protocol, spec_version), and flags:

  - version-drift (medium) — protocol has ≥ 2 distinct versions in use
  - low-confidence-routing (low) — doc detected by shape signals only
  - no-version-discriminator (info) — doc has no version field
  - unknown-protocol-document (low) — doc didn't match any spec

Exit codes:
  0 — no drift (or --fail-on-drift not set)
  1 — drift found AND --fail-on-drift set
  2 — usage / I/O error`;

function loadDir(dir: string): Array<{ path: string; doc: unknown }> {
  const out: Array<{ path: string; doc: unknown }> = [];
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    const full = join(dir, entry);
    if (!statSync(full).isFile()) continue;
    out.push({ path: full, doc: JSON.parse(readFileSync(full, "utf8")) });
  }
  return out;
}

export function run(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    return 2;
  }
  if (args.help || !args.dir) {
    process.stdout.write(`${HELP}\n`);
    return args.help ? 0 : 2;
  }

  let files;
  try {
    files = loadDir(args.dir);
  } catch (e) {
    process.stderr.write(`error reading ${args.dir}: ${(e as Error).message}\n`);
    return 2;
  }

  const report = track(files, { now: args.now });
  let out: string;
  if (args.format === "json") out = JSON.stringify(report, null, 2);
  else if (args.format === "markdown") out = toMarkdown(report);
  else out = toSummary(report);

  if (args.out) writeFileSync(args.out, `${out}\n`, "utf8");
  else process.stdout.write(`${out}\n`);

  if (args.failOnDrift && report.buckets.some((b) => b.hasDrift)) return 1;
  return 0;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  try {
    process.exit(run(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`fatal: ${(e as Error).message}\n`);
    process.exit(2);
  }
}
