import { resolve } from "node:path";

export function nowIso(): string {
  return new Date().toISOString();
}

export function log(msg: string): void {
  // MCP servers should log to stderr.
  process.stderr.write(`[project-context-mcp] ${nowIso()} ${msg}\n`);
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
