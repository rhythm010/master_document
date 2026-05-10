import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
function field(block, label) {
    const match = block.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
    return match?.[1]?.trim() ?? "";
}
function sectionText(block, heading) {
    const idx = block.search(new RegExp(`^${heading}:\\s*$`, "im"));
    if (idx === -1)
        return "";
    const after = block.slice(idx).split(/\r?\n/).slice(1).join("\n");
    const next = after.search(/^[A-Z][A-Za-z ]+:\s*$/m);
    return (next === -1 ? after : after.slice(0, next)).trim();
}
function normalizeFilterStatus(gap) {
    const status = gap.status.toLowerCase();
    if (status.includes("resolved"))
        return "resolved";
    if (status.includes("open") || status.includes("progress") || status.includes("deferred"))
        return "open";
    if (gap.workaround && gap.workaround.toLowerCase() !== "none - blocker")
        return "workaround";
    return status;
}
export function parseBackendGaps(repoRoot, status) {
    const path = join(repoRoot, "technical", "frontend-companion", "backend-gap-register.md");
    if (!existsSync(path))
        return [];
    const markdown = readFileSync(path, "utf8");
    const blocks = markdown.split(/^###\s+/m).slice(1);
    const gaps = blocks.map((block) => {
        const [heading = "", ...rest] = block.split(/\r?\n/);
        const body = rest.join("\n");
        const idMatch = heading.match(/^(FE-BE-GAP-\d+):\s*(.+)$/);
        const workaround = sectionText(body, "Current frontend workaround") || null;
        return {
            id: idMatch?.[1] ?? heading.trim(),
            description: (sectionText(body, "Gap") || idMatch?.[2] || "").trim(),
            status: field(body, "Status"),
            workaround,
        };
    }).filter((gap) => gap.id !== "FE-BE-GAP-000");
    if (!status)
        return gaps;
    return gaps.filter((gap) => normalizeFilterStatus(gap) === status);
}
