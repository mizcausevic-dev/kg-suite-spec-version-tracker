import { detect } from "./detect.js";
import type {
  DetectedFile,
  Finding,
  FleetVersionReport,
  ProtocolBucket,
  ProtocolId,
  TrackOptions,
  VersionEntry
} from "./types.js";

const UNVERSIONED = "__unversioned__";

/**
 * Track spec-version distribution across a list of pre-loaded documents.
 *
 * For each (protocol, version) pair, accumulate the file count and the
 * referencing paths. Flag findings for version drift (≥ 2 versions for the
 * same protocol), low-confidence routings, and unknown documents.
 */
export function track(files: Array<{ path: string; doc: unknown }>, opts: TrackOptions = {}): FleetVersionReport {
  const generatedAt = opts.now ?? new Date().toISOString();
  const detected: DetectedFile[] = files.map((f) => ({ file: f.path, detect: detect(f.doc) }));
  const findings: Finding[] = [];

  // Group by protocol → version → entry
  const byProtocol = new Map<ProtocolId, Map<string, VersionEntry>>();
  for (const d of detected) {
    if (d.detect.protocol === "unknown") {
      findings.push({
        code: "unknown-protocol-document",
        severity: "low",
        message: `${d.detect.reason}`,
        file: d.file
      });
      continue;
    }
    const ver = d.detect.version ?? UNVERSIONED;
    const versions = byProtocol.get(d.detect.protocol) ?? new Map<string, VersionEntry>();
    const entry = versions.get(ver) ?? { version: ver, count: 0, files: [] };
    entry.count += 1;
    entry.files.push(d.file);
    versions.set(ver, entry);
    byProtocol.set(d.detect.protocol, versions);

    if (d.detect.confidence === "low") {
      findings.push({
        code: "low-confidence-routing",
        severity: "low",
        message: `Detected as ${d.detect.protocol} with low confidence: ${d.detect.reason}.`,
        protocol: d.detect.protocol,
        file: d.file
      });
    }
    if (d.detect.version === undefined && d.detect.protocol !== "otel-genai-otlp" && d.detect.protocol !== "mcp-tools-list") {
      findings.push({
        code: "no-version-discriminator",
        severity: "info",
        message: `${d.detect.protocol} document has no explicit version discriminator field.`,
        protocol: d.detect.protocol,
        file: d.file
      });
    }
  }

  const buckets: ProtocolBucket[] = [];
  for (const [protocol, versions] of byProtocol) {
    const list = [...versions.values()].sort((a, b) => a.version.localeCompare(b.version));
    const total = list.reduce((acc, v) => acc + v.count, 0);
    const distinct = list.filter((v) => v.version !== UNVERSIONED).length;
    const hasDrift = distinct >= 2;
    buckets.push({ protocol, total, versions: list, hasDrift });

    if (hasDrift) {
      findings.push({
        code: "version-drift",
        severity: "medium",
        message: `${protocol} fleet has ${distinct} distinct spec versions in use: ${list
          .filter((v) => v.version !== UNVERSIONED)
          .map((v) => `${v.version}×${v.count}`)
          .join(", ")}.`,
        protocol
      });
    }
  }
  buckets.sort((a, b) => a.protocol.localeCompare(b.protocol));

  const ok = !findings.some((f) => f.severity === "high");
  return {
    generatedAt,
    files: detected.length,
    buckets,
    findings,
    ok
  };
}
