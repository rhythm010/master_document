export function splitIntoLooseSections(md) {
    const lines = md.split(/\r?\n/);
    const sections = [];
    let currentTitle = "(preamble)";
    let current = [];
    function flush() {
        sections.push({ title: currentTitle, content: current.join("\n").trim() });
        current = [];
    }
    for (const line of lines) {
        const h = line.match(/^\s*(?:#{1,6}|\d+\.)\s+(.+?)\s*$/);
        if (h) {
            flush();
            currentTitle = h[1].trim();
            continue;
        }
        current.push(line);
    }
    flush();
    return sections.filter((s) => s.content.length > 0 || s.title !== "(preamble)");
}
export function extractHttpEndpoints(text) {
    const results = [];
    // SDS style: "- GET /path" or "A. `POST /x`" etc.
    const re = /\b(GET|POST|PUT|PATCH|DELETE)\s+\/?([A-Za-z0-9_\-/{}/:.]+)\b/g;
    for (const m of text.matchAll(re)) {
        const method = m[1];
        const path = m[2].startsWith("/") ? m[2] : `/${m[2]}`;
        results.push({ method, path, raw: m[0] });
    }
    // Master doc style: **[GET] /venues?...**
    const re2 = /\*\*\[(GET|POST|PUT|PATCH|DELETE)\]\s+([^*\s]+)\*\*/g;
    for (const m of text.matchAll(re2)) {
        results.push({ method: m[1], path: m[2], raw: m[0] });
    }
    // De-dupe.
    const key = (x) => `${x.method} ${x.path}`;
    const seen = new Set();
    const deduped = [];
    for (const r of results) {
        const k = key(r);
        if (seen.has(k))
            continue;
        seen.add(k);
        deduped.push(r);
    }
    return deduped;
}
export function extractBulletLikeLines(text) {
    const lines = text.split(/\r?\n/);
    const out = [];
    for (const line of lines) {
        const t = line.trim();
        if (!t)
            continue;
        if (t.startsWith("- ") || t.startsWith("* ")) {
            out.push(t.replace(/^[-*]\s+/, "").trim());
            continue;
        }
        if (/^\d+\./.test(t)) {
            out.push(t.replace(/^\d+\.\s+/, "").trim());
            continue;
        }
    }
    return out;
}
export function extractArrows(text) {
    const lines = text.split(/\r?\n/);
    const arrows = [];
    for (const line of lines) {
        if (line.includes("→"))
            arrows.push(line.trim());
    }
    return arrows;
}
