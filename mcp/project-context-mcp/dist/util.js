import { resolve } from "node:path";
export function nowIso() {
    return new Date().toISOString();
}
export function log(msg) {
    // MCP servers should log to stderr.
    process.stderr.write(`[project-context-mcp] ${nowIso()} ${msg}\n`);
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
