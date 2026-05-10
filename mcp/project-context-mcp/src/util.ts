import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(join(new URL(".", import.meta.url).pathname, "../../.."));
const MCP_USAGE_DIR = join(REPO_ROOT, ".mcp-usage");
const MCP_USAGE_LOG = join(MCP_USAGE_DIR, "project-context-mcp.jsonl");
const GST_OFFSET_MS = 4 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowGst(): string {
  return new Date(Date.now() + GST_OFFSET_MS).toISOString().replace("Z", "+04:00");
}

export function log(msg: string): void {
  // MCP servers should log to stderr.
  const timestampUtc = nowIso();
  const timestampGst = nowGst();
  process.stderr.write(`[project-context-mcp] ${timestampGst} ${msg}\n`);
  try {
    mkdirSync(MCP_USAGE_DIR, { recursive: true });
    appendFileSync(
      MCP_USAGE_LOG,
      `${JSON.stringify({ timestamp: timestampGst, timestampGst, timestampUtc, server: "project-context-mcp", message: msg })}\n`
    );
  } catch {
    // Usage logging must never break MCP responses.
  }
}

export function jsonText(data: unknown): { type: "text"; text: string } {
  return { type: "text", text: JSON.stringify(data, null, 2) };
}

export function assertSafePath(repoRoot: string, candidatePath: string): void {
  const r = resolve(repoRoot);
  const c = resolve(candidatePath);
  if (c !== r && !c.startsWith(r + "/")) {
    throw new Error(`Unsafe path access blocked: ${candidatePath}`);
  }
}

export function normalizeFeatureKey(input: string): string {
  return input.trim().toLowerCase();
}
