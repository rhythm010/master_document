import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

// dist/ (or src/) -> project-context-mcp/ -> mcp/ -> repo root
export const REPO_ROOT = resolve(join(HERE, "../../.."));

export const SDS_DIR = join(REPO_ROOT, "SDS");
export const FEATURE_SDS_DIR = join(SDS_DIR, "feature-sds");
export const CORE_SDS_PATH = join(SDS_DIR, "core_sds.md");

export const MASTER_DOC_DIR = join(REPO_ROOT, "master-document");

export const BACKEND_ROOT = join(REPO_ROOT, "technical/backend-companion");
export const BACKEND_MODULES_DIR = join(BACKEND_ROOT, "src/modules");

export const PRISMA_SCHEMA_PATH = join(BACKEND_ROOT, "prisma/schema.prisma");
