// Walk a mixed-protocol directory, detect each doc's spec, and track
// version drift per protocol.

export type ProtocolId =
  | "agent-cards-spec"
  | "mcp-tool-card-spec"
  | "prompt-provenance-spec"
  | "evidence-bundle-spec"
  | "otel-genai-otlp"
  | "mcp-tools-list"
  | "unknown";

export type Confidence = "high" | "medium" | "low";

export interface DetectResult {
  protocol: ProtocolId;
  version?: string;
  confidence: Confidence;
  reason: string;
}

export type FindingSeverity = "high" | "medium" | "low" | "info";

export type FindingCode =
  | "version-drift"
  | "low-confidence-routing"
  | "no-version-discriminator"
  | "unknown-protocol-document"
  | "malformed-json";

export interface Finding {
  code: FindingCode;
  severity: FindingSeverity;
  message: string;
  protocol?: ProtocolId;
  file?: string;
}

export interface VersionEntry {
  /** e.g., "0.1" or "0.2". `__unversioned__` when shape-detected without a version field. */
  version: string;
  count: number;
  files: string[];
}

export interface ProtocolBucket {
  protocol: ProtocolId;
  total: number;
  versions: VersionEntry[];
  /** True when ≥ 2 distinct versions are present for this protocol. */
  hasDrift: boolean;
}

export interface FleetVersionReport {
  generatedAt: string;
  files: number;
  buckets: ProtocolBucket[];
  findings: Finding[];
  ok: boolean;
}

export interface TrackOptions {
  /** Optional clock override for `generatedAt`. */
  now?: string;
}

/** A file's detection verdict + its path, suitable for accumulation. */
export interface DetectedFile {
  file: string;
  detect: DetectResult;
}
