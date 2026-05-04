function findLeadingCommentBlock(fullText, matchIndex) {
    const prefix = fullText.slice(0, matchIndex);
    const lines = prefix.split(/\r?\n/);
    const collected = [];
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.length === 0) {
            if (collected.length > 0)
                break;
            continue;
        }
        if (line.startsWith("//")) {
            collected.push(line.replace(/^\/\/\s?/, ""));
            continue;
        }
        break;
    }
    if (collected.length === 0)
        return undefined;
    return collected.reverse().join(" ").trim();
}
function extractHandler(argsText) {
    // Heuristic: last dotted identifier is usually the controller handler.
    const matches = Array.from(argsText.matchAll(/\b([A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*)\b/g)).map((m) => m[1]);
    if (matches.length === 0)
        return undefined;
    return matches[matches.length - 1];
}
export function parseExpressRouterRoutes(sourceFile, fileText) {
    const endpoints = [];
    const re = /router\.(get|post|put|patch|delete)\(\s*(["'`])([^"'`]+)\2([\s\S]*?)\);/g;
    for (const m of fileText.matchAll(re)) {
        const method = m[1].toUpperCase();
        const path = m[3];
        const argsText = m[4] ?? "";
        const roles = Array.from(argsText.matchAll(/requireRole\(\s*["'](CLIENT|COMPANION)["']\s*\)/g)).map((x) => x[1]);
        const notes = [];
        let kind = "public";
        if (argsText.includes("internalAuth")) {
            kind = "internal";
            notes.push("internalAuth");
        }
        else if (argsText.includes("authMiddleware")) {
            kind = "user";
            notes.push("authMiddleware");
        }
        if (roles.length > 0)
            notes.push(`requireRole(${roles.join(",")})`);
        endpoints.push({
            method,
            path,
            summary: findLeadingCommentBlock(fileText, m.index ?? 0),
            auth: { kind, roles: roles.length ? roles : undefined, notes: notes.length ? notes : undefined },
            handler: extractHandler(argsText),
            sourceFile,
        });
    }
    return endpoints;
}
