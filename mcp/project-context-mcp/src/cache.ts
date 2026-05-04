import { statSync, readFileSync } from "node:fs";

export interface CacheStats {
  hits: number;
  misses: number;
}

interface CacheEntry {
  mtimeMs: number;
  text: string;
  bytes: number;
}

export class FileTextCache {
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = { hits: 0, misses: 0 };

  readText(path: string): string {
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

  getStats(): CacheStats {
    return { ...this.stats };
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}
