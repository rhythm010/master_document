import { statSync, readFileSync } from "node:fs";
export class FileTextCache {
    cache = new Map();
    stats = { hits: 0, misses: 0 };
    readText(path) {
        const st = statSync(path);
        // Safety: avoid accidentally slurping huge blobs.
        if (st.size > 1_000_000) {
            throw new Error(`File too large to index safely (>1MB): ${path}`);
        }
        const existing = this.cache.get(path);
        if (existing && existing.mtimeMs === st.mtimeMs && existing.bytes === st.size) {
            this.stats.hits++;
            return existing.text;
        }
        this.stats.misses++;
        const text = readFileSync(path, "utf-8");
        this.cache.set(path, { mtimeMs: st.mtimeMs, text, bytes: st.size });
        return text;
    }
    getStats() {
        return { ...this.stats };
    }
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
    }
}
