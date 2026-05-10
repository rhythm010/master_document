import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
const ROUTE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
function walkRoutes(root) {
    if (!existsSync(root))
        return [];
    const out = [];
    for (const entry of readdirSync(root)) {
        const path = join(root, entry);
        const stat = statSync(path);
        if (stat.isDirectory())
            out.push(...walkRoutes(path));
        else if (ROUTE_EXTENSIONS.has(extname(path)))
            out.push(path);
    }
    return out;
}
function normalizeSegment(segment) {
    if (segment.startsWith("(") && segment.endsWith(")"))
        return null;
    if (segment === "index")
        return null;
    if (segment.startsWith("[...") && segment.endsWith("]"))
        return `:${segment.slice(4, -1)}*`;
    if (segment.startsWith("[") && segment.endsWith("]"))
        return `:${segment.slice(1, -1)}`;
    return segment;
}
function routePathFromFile(appDir, filePath) {
    const withoutExt = relative(appDir, filePath).replace(/\.[^.]+$/, "");
    const parts = withoutExt.split(/[\\/]/).map(normalizeSegment).filter((part) => Boolean(part));
    return `/${parts.join("/")}`.replace(/\/+$/, "") || "/";
}
function nearestLayout(appDir, filePath) {
    const relParts = relative(appDir, filePath).split(/[\\/]/);
    relParts.pop();
    while (relParts.length >= 0) {
        const dir = join(appDir, ...relParts);
        for (const ext of ROUTE_EXTENSIONS) {
            const candidate = join(dir, `_layout${ext}`);
            if (existsSync(candidate))
                return candidate;
        }
        if (relParts.length === 0)
            break;
        relParts.pop();
    }
    return "";
}
export function parseRouterConfig(appRoot) {
    const appDir = join(appRoot, "app");
    const routes = walkRoutes(appDir)
        .filter((path) => !path.match(/[\\/]_layout\.[^.]+$/))
        .map((filePath) => {
        const path = routePathFromFile(appDir, filePath);
        return {
            path,
            filePath,
            isDynamic: path.includes(":"),
            layout: nearestLayout(appDir, filePath),
        };
    })
        .sort((a, b) => a.path.localeCompare(b.path));
    return { routes };
}
