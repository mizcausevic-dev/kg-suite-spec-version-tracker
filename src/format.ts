import type { FindingSeverity, FleetVersionReport } from "./types.js";

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  high: "🔴 high",
  medium: "🟠 medium",
  low: "🟡 low",
  info: "ℹ️  info"
};
const SEVERITY_RANK: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };

export function toMarkdown(report: FleetVersionReport): string {
  const lines: string[] = [];
  lines.push(report.ok ? `# Suite spec-version tracker ✅` : `# Suite spec-version tracker ❌`);
  lines.push(``);
  lines.push(`Generated: \`${report.generatedAt}\``);
  lines.push(``);
  lines.push(`## Per protocol`);
  lines.push(``);
  if (report.buckets.length === 0) {
    lines.push(`_No Suite protocol documents detected._`);
  } else {
    lines.push(`| protocol | versions | drift? | total docs |`);
    lines.push(`|---|---|:---:|---:|`);
    for (const b of report.buckets) {
      const versionsCell = b.versions.map((v) => `${v.version}×${v.count}`).join(", ");
      lines.push(`| \`${b.protocol}\` | ${versionsCell} | ${b.hasDrift ? "⚠" : "—"} | ${b.total} |`);
    }
  }

  const ranked = [...report.findings].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  if (ranked.length > 0) {
    lines.push(``);
    lines.push(`## Findings (${ranked.length})`);
    lines.push(``);
    lines.push(`| severity | code | protocol | file | message |`);
    lines.push(`|---|---|---|---|---|`);
    for (const f of ranked) {
      lines.push(
        `| ${SEVERITY_LABEL[f.severity]} | \`${f.code}\` | ${f.protocol ?? "—"} | ${f.file ?? "—"} | ${f.message} |`
      );
    }
  } else {
    lines.push(``);
    lines.push(`No findings.`);
  }
  return lines.join("\n");
}

export function toSummary(report: FleetVersionReport): string {
  const driftBuckets = report.buckets.filter((b) => b.hasDrift).length;
  const protocols = report.buckets.length;
  return `${report.files} file${report.files === 1 ? "" : "s"} · ${protocols} protocol${protocols === 1 ? "" : "s"} · ${driftBuckets} with drift (${report.ok ? "ok" : "fail"})`;
}
