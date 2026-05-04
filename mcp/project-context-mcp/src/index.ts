import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { existsSync, readdirSync } from "node:fs";

import { FileTextCache } from "./cache.js";
import { FEATURE_SDS_DIR, REPO_ROOT } from "./paths.js";
import {
  getCoreSdsPath,
  getPrismaSchemaPath,
  getRouteFileForModule,
  KNOWN_MODULES,
  listMasterDocFiles,
  resolveLatestFeatureSdsPath,
  type KnownModule,
} from "./indexer.js";
import { extractArrows, extractBulletLikeLines, extractHttpEndpoints, splitIntoLooseSections } from "./parsers/markdown.js";
import { parsePrismaModel, listPrismaModels } from "./parsers/prisma.js";
import { parseExpressRouterRoutes } from "./parsers/routes.js";
import { assertSafePath, jsonText, log, normalizeFeatureKey } from "./util.js";

const cache = new FileTextCache();

const server = new Server(
  { name: "project-context-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

function safeRead(path: string): string {
  assertSafePath(REPO_ROOT, path);
  return cache.readText(path);
}

function parseInvariantsFromCoreSds(md: string): string[] {
  const marker = "## 4. System Invariants";
  const idx = md.indexOf(marker);
  if (idx === -1) return [];
  const after = md.slice(idx + marker.length);
  const next = after.search(/\n##\s+/);
  const block = next === -1 ? after : after.slice(0, next);
  return extractBulletLikeLines(block);
}

function buildModuleContract(module: KnownModule) {
  const routePath = getRouteFileForModule(module);
  if (!existsSync(routePath)) {
    return {
      module,
      error: `Route file not found for module '${module}' (expected ${routePath})`,
      endpoints: [],
      sources: [routePath],
    };
  }

  const text = safeRead(routePath);
  const endpoints = parseExpressRouterRoutes(routePath, text);

  const authSummary = endpoints.reduce(
    (acc, e) => {
      acc.total++;
      acc[e.auth.kind]++;
      return acc;
    },
    { total: 0, public: 0, user: 0, internal: 0 }
  );

  return {
    module,
    routeFile: routePath,
    endpoints,
    authSummary,
  };
}

function buildFeatureSds(feature: string) {
  const key = normalizeFeatureKey(feature);
  const path = resolveLatestFeatureSdsPath(key);
  if (!path) {
    return {
      feature,
      error: `No Feature SDS found for '${feature}'. Looked under SDS/feature-sds/.`,
    };
  }

  const md = safeRead(path);

  // Metadata: very light (first ~20 lines key:value)
  const metadata: Record<string, string> = {};
  for (const line of md.split(/\r?\n/).slice(0, 30)) {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 _-]+):\s*(.+)\s*$/);
    if (m) metadata[m[1].trim()] = m[2].trim();
  }

  const sections = splitIntoLooseSections(md);
  const sectionText = (titleIncludes: string[]) => {
    const t = titleIncludes.map((x) => x.toLowerCase());
    const matched = sections.filter((s) => t.some((w) => s.title.toLowerCase().includes(w)));
    return matched.map((s) => s.content).join("\n\n");
  };

  const apiText = sectionText(["API Contract", "API"]);
  const businessText = sectionText(["Business Logic", "Authorization", "Preconditions", "Constraints"]);
  const stateText = sectionText(["State Changes", "State"]);
  const nonGoalsText = sectionText(["Out of Scope", "Non-goals", "Non Goals"]);

  const apis = extractHttpEndpoints(apiText.length ? apiText : md).map((e) => ({
    method: e.method,
    path: e.path,
  }));

  const businessRules = extractBulletLikeLines(businessText.length ? businessText : md).slice(0, 200);

  const stateTransitions = Array.from(new Set([ ...extractArrows(stateText), ...extractArrows(md) ])).slice(0, 200);

  // Validations: try to pull from Preconditions/Constraints/Failure Cases.
  const validationsText = sectionText(["Preconditions", "Constraints", "Failure"]);
  const validations = extractBulletLikeLines(validationsText.length ? validationsText : md).slice(0, 200);

  // Non-goals: either explicit section or inline "Out of Scope:" line.
  const outOfScopeInline = md.match(/\bOut of Scope\s*:\s*(.+)$/im)?.[1];
  const nonGoals = Array.from(
    new Set([
      ...(nonGoalsText ? extractBulletLikeLines(nonGoalsText) : []),
      ...(outOfScopeInline ? [outOfScopeInline.trim()] : []),
    ])
  );

  return {
    feature: key,
    resolvedPath: path,
    metadata,
    apis,
    businessRules,
    stateTransitions,
    validations,
    nonGoals,
    sources: [path],
  };
}

function buildSchemaEntity(entity: string) {
  const schemaPath = getPrismaSchemaPath();
  if (!existsSync(schemaPath)) {
    return { entity, error: `Prisma schema not found at ${schemaPath}` };
  }

  const schema = safeRead(schemaPath);
  const model = parsePrismaModel(schema, entity);

  if (!model) {
    return {
      entity,
      error: `Model '${entity}' not found in Prisma schema.` ,
      availableEntities: listPrismaModels(schema).slice(0, 200),
      sources: [schemaPath],
    };
  }

  // Add a small amount of derived structure.
  const fields = model.fields.map((f) => {
    const attrs = f.attributes.join(" ");
    const isId = /\s@id\b/.test(` ${attrs}`);
    const isUnique = /\s@unique\b/.test(` ${attrs}`);
    const relation = attrs.match(/@relation\([^)]*\)/)?.[0] ?? null;

    return {
      name: f.name,
      type: f.rawType,
      isOptional: f.isOptional,
      isList: f.isList,
      isId,
      isUnique,
      relation,
      attributes: f.attributes,
    };
  });

  return {
    entity: model.name,
    fields,
    modelAttributes: model.modelAttributes,
    sources: [schemaPath],
  };
}

function buildSupportMatrix() {
  const masterFiles = listMasterDocFiles();
  const moduleContracts = KNOWN_MODULES.map((m) => buildModuleContract(m));
  const codeEndpoints = moduleContracts.flatMap((mc) =>
    (mc.endpoints ?? []).map((e) => ({ module: mc.module, method: e.method, path: e.path }))
  );

  const normalizePath = (p: string) =>
    p
      .replace(/\{[^}]+\}/g, ":param")
      .replace(/:[A-Za-z0-9_]+/g, ":param")
      .replace(/\?.*$/, "");

  const codeSet = new Set(codeEndpoints.map((e) => `${e.method} ${normalizePath(e.path)}`));

  const flows = masterFiles.map((file) => {
    const md = safeRead(file);
    const specEndpoints = extractHttpEndpoints(md).map((e) => ({
      method: e.method,
      path: e.path,
      key: `${e.method} ${normalizePath(e.path)}`,
    }));

    const supported = specEndpoints.filter((e) => codeSet.has(e.key));
    const missing = specEndpoints.filter((e) => !codeSet.has(e.key));

    let status: "SUPPORTED" | "PARTIAL" | "SPEC_ONLY" | "NO_SPEC_ENDPOINTS";
    if (specEndpoints.length === 0) status = "NO_SPEC_ENDPOINTS";
    else if (missing.length === 0) status = "SUPPORTED";
    else if (supported.length === 0) status = "SPEC_ONLY";
    else status = "PARTIAL";

    return {
      flow: file.split("/").pop(),
      specEndpointCount: specEndpoints.length,
      supportedCount: supported.length,
      missingCount: missing.length,
      status,
      missing: missing.slice(0, 30).map((m) => ({ method: m.method, path: m.path })),
      sources: [file],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    flows,
    notes: [
      "Heuristic v1: compares master-document declared endpoints vs Express route files under technical/backend-companion/src/modules/*.",
      "This matrix intentionally does not infer UI-only behavior or internal service calls.",
    ],
  };
}

function buildBusinessRules(topic: string, limit = 50) {
  const q = topic.trim().toLowerCase();
  if (!q) return { topic, rules: [] };

  const sources: Array<{ path: string; kind: "feature-sds" | "core-sds" | "master-doc" }> = [];

  // Feature SDS
  // Note: we avoid listing all SDS files recursively; only feature-sds folder + core + master.
  // We'll scan file names in feature-sds for matches and also scan all master-doc files.
  // This is local-only and designed to be "good enough" for agent context retrieval.

  // feature-sds files
  if (existsSync(FEATURE_SDS_DIR)) {
    for (const f of readdirSync(FEATURE_SDS_DIR)) {
      if (!f.endsWith(".md")) continue;
      sources.push({ path: `${FEATURE_SDS_DIR}/${f}`, kind: "feature-sds" });
    }
  }

  // core
  sources.push({ path: getCoreSdsPath(), kind: "core-sds" });

  // master docs
  for (const f of listMasterDocFiles()) sources.push({ path: f, kind: "master-doc" });

  const hits: Array<{ text: string; source: string; kind: string }> = [];

  for (const s of sources) {
    if (!existsSync(s.path)) continue;
    const md = safeRead(s.path);
    const lines = extractBulletLikeLines(md);

    for (const line of lines) {
      const hay = line.toLowerCase();
      if (hay.includes(q)) {
        hits.push({ text: line, source: s.path, kind: s.kind });
        if (hits.length >= limit) break;
      }
    }
    if (hits.length >= limit) break;
  }

  return {
    topic,
    count: hits.length,
    rules: hits,
    notes: ["Rules are extracted from bullet/numbered lines only (heuristic v1)."],
  };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_module_contract",
        description: "Return structured endpoint/auth/behavior summary for a module.",
        inputSchema: {
          type: "object",
          required: ["module"],
          properties: {
            module: {
              type: "string",
              enum: [...KNOWN_MODULES],
              description: `One of: ${KNOWN_MODULES.join(", ")}`,
            },
          },
        },
      },
      {
        name: "get_feature_sds",
        description:
          "Return structured business rules, state transitions, validations, APIs, and non-goals for a feature (latest/current Feature SDS only).",
        inputSchema: {
          type: "object",
          required: ["feature"],
          properties: {
            feature: { type: "string", description: "Feature key, e.g. 'matching-flow'" },
          },
        },
      },
      {
        name: "get_schema_entity",
        description: "Return fields, types, constraints, relations for a specific Prisma entity only.",
        inputSchema: {
          type: "object",
          required: ["entity"],
          properties: {
            entity: { type: "string", description: "Prisma model name, e.g. 'User'" },
          },
        },
      },
      {
        name: "get_feature_support_matrix",
        description: "Return precomputed spec-vs-code support status for major flows.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "get_business_rules",
        description: "Return only the rules relevant to a topic across SDS + master docs.",
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            limit: { type: "number", description: "Max results (default 50)" },
          },
        },
      },
      {
        name: "get_invariants",
        description: "Return all core SDS invariants as structured data.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const started = Date.now();

  log(`Tool called: ${name} | args: ${JSON.stringify(args)}`);

  try {
    if (name === "get_module_contract") {
      const module = args.module as KnownModule;
      const result = buildModuleContract(module);
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    if (name === "get_feature_sds") {
      const feature = String(args.feature ?? "");
      const result = buildFeatureSds(feature);
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    if (name === "get_schema_entity") {
      const entity = String(args.entity ?? "");
      const result = buildSchemaEntity(entity);
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    if (name === "get_feature_support_matrix") {
      const result = buildSupportMatrix();
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    if (name === "get_business_rules") {
      const topic = String(args.topic ?? "");
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const result = buildBusinessRules(topic, limit);
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    if (name === "get_invariants") {
      const corePath = getCoreSdsPath();
      const md = safeRead(corePath);
      const invariants = parseInvariantsFromCoreSds(md);
      const result = { invariants, count: invariants.length, sources: [corePath] };
      return { content: [jsonText({ ...result, cache: cache.getStats() })] };
    }

    return { content: [jsonText({ error: `Unknown tool: ${name}` })], isError: true };
  } finally {
    log(`Tool finished: ${name} | durationMs=${Date.now() - started}`);
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("project-context-mcp started on stdio transport");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
