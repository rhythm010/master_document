import { appendFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
const REPO_ROOT = resolve(join(new URL(".", import.meta.url).pathname, "../../.."));
const MCP_USAGE_DIR = join(REPO_ROOT, ".mcp-usage");
const MCP_USAGE_LOG = join(MCP_USAGE_DIR, "project-context-mcp.jsonl");
export function nowIso() {
    return new Date().toISOString();
}
export function log(msg) {
    // MCP servers should log to stderr.
    const timestamp = nowIso();
    process.stderr.write(`[project-context-mcp] ${timestamp} ${msg}\n`);
    try {
        mkdirSync(MCP_USAGE_DIR, { recursive: true });
        appendFileSync(MCP_USAGE_LOG, `${JSON.stringify({ timestamp, server: "project-context-mcp", message: msg })}\n`);
    }
    catch {
        // Usage logging must never break MCP responses.
    }
}
export function jsonText(data) {
    return { type: "text", text: JSON.stringify(data, null, 2) };
}
export function assertSafePath(repoRoot, candidatePath) {
    const r = resolve(repoRoot);
    const c = resolve(candidatePath);
    if (c !== r && !c.startsWith(r + "/")) {
        throw new Error(`Unsafe path access blocked: ${candidatePath}`);
    }
}
export function normalizeFeatureKey(input) {
    return input.trim().toLowerCase();
}
