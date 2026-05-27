import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { detect } from "../src/detect.js";
import { track } from "../src/track.js";
import { toMarkdown, toSummary } from "../src/format.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const NOW = "2026-05-26T20:00:00Z";

function loadFleet(): Array<{ path: string; doc: unknown }> {
  const dir = `${here}/../fixtures/mixed`;
  return readdirSync(dir)
    .filter((e) => e.endsWith(".json"))
    .map((e) => ({ path: `fixtures/mixed/${e}`, doc: JSON.parse(readFileSync(`${dir}/${e}`, "utf8")) }));
}

describe("track", () => {
  it("buckets the 4 versioned-spec quartet + OTLP + mcp-tools-list + unknown", () => {
    const r = track(loadFleet(), { now: NOW });
    expect(r.files).toBe(9);
    const protocols = r.buckets.map((b) => b.protocol);
    expect(protocols).toContain("agent-cards-spec");
    expect(protocols).toContain("mcp-tool-card-spec");
    expect(protocols).toContain("prompt-provenance-spec");
    expect(protocols).toContain("evidence-bundle-spec");
    expect(protocols).toContain("otel-genai-otlp");
    expect(protocols).toContain("mcp-tools-list");
    expect(r.generatedAt).toBe(NOW);
  });

  it("flags version-drift (medium) on agent-cards-spec (v0.1 + v0.2 mixed)", () => {
    const r = track(loadFleet(), { now: NOW });
    const driftFindings = r.findings.filter((f) => f.code === "version-drift");
    expect(driftFindings.length).toBe(1);
    expect(driftFindings[0].protocol).toBe("agent-cards-spec");
    expect(driftFindings[0].severity).toBe("medium");
    expect(driftFindings[0].message).toContain("0.1×2");
    expect(driftFindings[0].message).toContain("0.2×1");
  });

  it("sets hasDrift on the drifting bucket only", () => {
    const r = track(loadFleet(), { now: NOW });
    const acBucket = r.buckets.find((b) => b.protocol === "agent-cards-spec")!;
    const tcBucket = r.buckets.find((b) => b.protocol === "mcp-tool-card-spec")!;
    expect(acBucket.hasDrift).toBe(true);
    expect(tcBucket.hasDrift).toBe(false);
    expect(acBucket.total).toBe(3);
    expect(acBucket.versions.length).toBe(2);
  });

  it("flags unknown-protocol-document for unrecognized JSON", () => {
    const r = track(loadFleet(), { now: NOW });
    const codes = r.findings.filter((f) => f.code === "unknown-protocol-document");
    expect(codes.length).toBe(1);
    expect(codes[0].file).toContain("unknown-blob");
  });

  it("flags no-version-discriminator (info) for shape-detected docs (no version)", () => {
    // Construct a shape-only agent card with no agent_card_version field.
    const fleet = [
      {
        path: "fixtures/shape-only.json",
        doc: {
          agent: { id: "x", name: "X" },
          capabilities: { primary_purpose: "p" },
          refusal_taxonomy: []
        }
      }
    ];
    const r = track(fleet, { now: NOW });
    expect(r.findings.some((f) => f.code === "no-version-discriminator")).toBe(true);
    expect(r.findings.some((f) => f.code === "low-confidence-routing")).toBe(true);
  });

  it("does not flag OTLP or mcp-tools-list with no-version-discriminator (they have no version concept)", () => {
    const r = track(loadFleet(), { now: NOW });
    const noVer = r.findings.filter((f) => f.code === "no-version-discriminator");
    for (const f of noVer) {
      expect(f.protocol === "otel-genai-otlp" || f.protocol === "mcp-tools-list").toBe(false);
    }
  });

  it("flags low-confidence-routing on mcp-tools-list (medium detect) — wait, only low-confidence is flagged", () => {
    const r = track(loadFleet(), { now: NOW });
    // mcp-tools-list detection is "medium", so it should NOT trigger low-confidence-routing.
    const mcpToolsFindings = r.findings.filter(
      (f) => f.code === "low-confidence-routing" && f.protocol === "mcp-tools-list"
    );
    expect(mcpToolsFindings.length).toBe(0);
  });

  it("ok=true even with version-drift (drift is medium, not high)", () => {
    const r = track(loadFleet(), { now: NOW });
    expect(r.ok).toBe(true); // no high findings ever
  });

  it("handles an empty fleet gracefully", () => {
    const r = track([], { now: NOW });
    expect(r.files).toBe(0);
    expect(r.buckets).toHaveLength(0);
    expect(r.findings).toHaveLength(0);
  });

  it("buckets are sorted by protocol id", () => {
    const r = track(loadFleet(), { now: NOW });
    const protocols = r.buckets.map((b) => b.protocol);
    expect([...protocols].sort()).toEqual(protocols);
  });

  it("uses provided 'now' over Date.now()", () => {
    const r = track(loadFleet(), { now: "2030-01-01T00:00:00Z" });
    expect(r.generatedAt).toBe("2030-01-01T00:00:00Z");
  });

  it("detect() — exported helper routes high-confidence on a versioned doc", () => {
    expect(detect({ agent_card_version: "0.1" }).protocol).toBe("agent-cards-spec");
    expect(detect({ tool_card_version: "0.1" }).protocol).toBe("mcp-tool-card-spec");
    expect(detect({ provenance_version: "0.1" }).protocol).toBe("prompt-provenance-spec");
    expect(detect({ evidence_bundle_version: "0.1" }).protocol).toBe("evidence-bundle-spec");
    expect(detect({ resourceSpans: [] }).protocol).toBe("otel-genai-otlp");
    expect(detect(null).protocol).toBe("unknown");
    expect(detect({}).protocol).toBe("unknown");
  });

  it("toMarkdown renders per-protocol table and version cells", () => {
    const md = toMarkdown(track(loadFleet(), { now: NOW }));
    expect(md).toContain("# Suite spec-version tracker ✅");
    expect(md).toContain("## Per protocol");
    expect(md).toContain("| `agent-cards-spec` | 0.1×2, 0.2×1 | ⚠ | 3 |");
    expect(md).toContain("## Findings");
  });

  it("toMarkdown renders empty-fleet message", () => {
    const md = toMarkdown(track([], { now: NOW }));
    expect(md).toContain("_No Suite protocol documents detected._");
    expect(md).toContain("No findings.");
  });

  it("toSummary line-formats counts", () => {
    const s = toSummary(track(loadFleet(), { now: NOW }));
    expect(s).toContain("9 files");
    expect(s).toContain("protocols");
    expect(s).toContain("1 with drift");
    expect(s).toContain("(ok)");
  });

  it("toSummary handles singular file count", () => {
    const r = track([{ path: "x.json", doc: { agent_card_version: "0.1" } }], { now: NOW });
    expect(toSummary(r)).toContain("1 file ·");
    expect(toSummary(r)).toContain("1 protocol ·");
  });
});
