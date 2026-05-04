import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  FEATURE_SDS_DIR,
  CORE_SDS_PATH,
  MASTER_DOC_DIR,
  PRISMA_SCHEMA_PATH,
  BACKEND_MODULES_DIR,
} from "./paths.js";

export const KNOWN_MODULES = [
  "identity",
  "booking",
  "matching",
  "companion-profile",
  "roster",
  "session-in-progress",
  "ratings",
] as const;

export type KnownModule = (typeof KNOWN_MODULES)[number];

export function getRouteFileForModule(module: KnownModule): string {
  const direct = join(BACKEND_MODULES_DIR, module, `${module}.route.ts`);
  if (existsSync(direct)) return direct;

  // Fallback: pick the first *.route.ts file in the module folder.
  const dir = join(BACKEND_MODULES_DIR, module);
  const candidates = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith(".route.ts"))
    : [];
  if (candidates.length > 0) return join(dir, candidates[0]);

  return direct;
}

export function listMasterDocFiles(): string[] {
  if (!existsSync(MASTER_DOC_DIR)) return [];
  return readdirSync(MASTER_DOC_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(MASTER_DOC_DIR, f));
}

export function resolveLatestFeatureSdsPath(featureKey: string): string | null {
  if (!existsSync(FEATURE_SDS_DIR)) return null;

  const files = readdirSync(FEATURE_SDS_DIR).filter((f) => f.endsWith(".md"));

  // 1) Unversioned current alias: <feature>.feature-sds.md
  const alias1 = `${featureKey}.feature-sds.md`;
  if (files.includes(alias1)) return join(FEATURE_SDS_DIR, alias1);

  // 2) Explicit current alias: <feature>_current.md
  const alias2 = `${featureKey}_current.md`;
  if (files.includes(alias2)) return join(FEATURE_SDS_DIR, alias2);

  // 3) Highest semver versioned file.
  const semverRe = new RegExp(`^${featureKey}(?:\\.feature-sds)?(?:\\.|_)?v(\\d+)\\.(\\d+)\\.(\\d+)\\.md$`);
  const candidates = files
    .map((f) => {
      const m = f.match(semverRe);
      if (!m) return null;
      return { f, v: [Number(m[1]), Number(m[2]), Number(m[3])] as const };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (candidates.length === 0) {
    // Last resort: fuzzy contains match.
    const fuzzy = files.find((f) => f.toLowerCase().includes(featureKey.toLowerCase()));
    return fuzzy ? join(FEATURE_SDS_DIR, fuzzy) : null;
  }

  candidates.sort((a, b) => {
    for (let i = 0; i < 3; i++) {
      if (a.v[i] !== b.v[i]) return b.v[i] - a.v[i];
    }
    return 0;
  });

  return join(FEATURE_SDS_DIR, candidates[0].f);
}

export function getCoreSdsPath(): string {
  return CORE_SDS_PATH;
}

export function getPrismaSchemaPath(): string {
  return PRISMA_SCHEMA_PATH;
}
