import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, basename, resolve } from "node:path";

// ─── Paths ────────────────────────────────────────────────────────────────────

const BACKEND_ROOT = join(
  new URL(".", import.meta.url).pathname,
  "../../../technical/backend-companion"
);
const REPO_ROOT = resolve(join(BACKEND_ROOT, "../.."));
const MCP_USAGE_DIR = join(REPO_ROOT, ".mcp-usage");
const MCP_USAGE_LOG = join(MCP_USAGE_DIR, "test-runner-mcp.jsonl");

const MODULES_DIR = join(BACKEND_ROOT, "src/modules");
const QA_DIR = join(BACKEND_ROOT, "qa");
const RESULTS_DIR = join(BACKEND_ROOT, "results");

// ─── Known modules ────────────────────────────────────────────────────────────

const KNOWN_MODULES = [
  "identity",
  "booking",
  "matching",
  "companion-profile",
  "roster",
  "session-in-progress",
  "ratings",
] as const;

type Module = (typeof KNOWN_MODULES)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  // MCP stderr — visible in VS Code Output > MCP panel
  process.stderr.write(`[test-runner-mcp] ${msg}\n`);
  try {
    mkdirSync(MCP_USAGE_DIR, { recursive: true });
    appendFileSync(
      MCP_USAGE_LOG,
      `${JSON.stringify({ timestamp: new Date().toISOString(), server: "test-runner-mcp", message: msg })}\n`
    );
  } catch {
    // Usage logging must never break MCP responses.
  }
}

function moduleTestsDir(module: Module): string {
  return join(MODULES_DIR, module, "__tests__");
}

function moduleResultsDir(module: Module): string {
  return join(MODULES_DIR, module, "__tests__", "results");
}

interface TestFile {
  path: string;
  testId: string;
  scenarioName: string;
  artifactStatus: string;
  module: string;
  type: "module" | "journey";
}

function discoverModuleTests(module: Module): TestFile[] {
  const dir = moduleTestsDir(module);
  if (!existsSync(dir)) return [];

  const results: TestFile[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f.includes("-result") || f === "TEST-DESIGN-SUMMARY.json") continue;
    const filePath = join(dir, f);
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
      results.push({
        path: filePath,
        testId: typeof raw.testId === "string" ? raw.testId : basename(f, ".json"),
        scenarioName: typeof raw.scenarioName === "string" ? raw.scenarioName : "Unknown",
        artifactStatus: typeof raw.artifactStatus === "string" ? raw.artifactStatus : "UNKNOWN",
        module,
        type: "module",
      });
    } catch {
      // skip unparseable
    }
  }
  return results;
}

function discoverJourneyTests(): TestFile[] {
  if (!existsSync(QA_DIR)) return [];

  // search recursively for JSON test files under qa/
  function walk(dir: string): TestFile[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: TestFile[] = [];
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...walk(full));
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        entry.name.startsWith("JRN-") &&
        !entry.name.includes("-result")
      ) {
        try {
          const raw = JSON.parse(readFileSync(full, "utf-8"));
          files.push({
            path: full,
            testId: raw.testId ?? basename(entry.name, ".json"),
            scenarioName: raw.scenarioName ?? "Unknown",
            artifactStatus: raw.artifactStatus ?? "UNKNOWN",
            module: "journey",
            type: "journey",
          });
        } catch {
          // skip unparseable files
        }
      }
    }
    return files;
  }

  return walk(QA_DIR);
}

function getLastResult(testId: string): Record<string, unknown> | null {
  // Check module results dirs
  for (const mod of KNOWN_MODULES) {
    const dir = moduleResultsDir(mod);
    if (!existsSync(dir)) continue;
    const candidates = readdirSync(dir).filter(
      (f) => f.startsWith(testId) && f.endsWith("-result.json")
    );
    if (candidates.length > 0) {
      const filePath = join(dir, candidates[0]);
      try {
        return JSON.parse(readFileSync(filePath, "utf-8"));
      } catch {
        return null;
      }
    }
  }

  // Check top-level results dir (journeys)
  if (existsSync(RESULTS_DIR)) {
    const candidates = readdirSync(RESULTS_DIR).filter(
      (f) => f.startsWith(testId) && f.endsWith("-result.json")
    );
    if (candidates.length > 0) {
      try {
        return JSON.parse(readFileSync(join(RESULTS_DIR, candidates[0]), "utf-8"));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function checkEnvironmentStatus(): Promise<{
  api: "OK" | "FAIL";
  db: "OK" | "FAIL";
  mailpit: "OK" | "FAIL";
  docker: "OK" | "FAIL";
  details: Record<string, string>;
}> {
  return new Promise((resolve) => {
    const result = {
      api: "FAIL" as "OK" | "FAIL",
      db: "FAIL" as "OK" | "FAIL",
      mailpit: "FAIL" as "OK" | "FAIL",
      docker: "FAIL" as "OK" | "FAIL",
      details: {} as Record<string, string>,
    };

    let pending = 3;
    function done() {
      pending--;
      if (pending === 0) resolve(result);
    }

    // API health check
    execFile("curl", ["-sf", "http://localhost:3000/health"], (err) => {
      if (!err) {
        result.api = "OK";
      } else {
        result.details.api = "API not reachable at http://localhost:3000/health — run: npm run dev";
      }
      done();
    });

    // Mailpit check
    execFile("curl", ["-sf", "http://localhost:8025/api/v1/messages"], (err) => {
      if (!err) {
        result.mailpit = "OK";
      } else {
        result.details.mailpit = "Mailpit not reachable — run: docker compose up -d";
      }
      done();
    });

    // Docker + DB check via machine-readable compose output
    // (human output varies across Docker/Compose versions; e.g. "Up" vs "running").
    execFile(
      "docker",
      [
        "compose",
        "-f",
        join(BACKEND_ROOT, "docker-compose.yml"),
        "ps",
        "--services",
        "--filter",
        "status=running",
      ],
      (err, stdout) => {
        if (!err && stdout.split("\n").map((l) => l.trim()).includes("db")) {
          result.docker = "OK";
          result.db = "OK";
        } else {
          result.details.docker = "Docker containers not running — run: docker compose up -d";
          result.details.db = "Database container not running — run: docker compose up -d";
        }
        done();
      }
    );
  });
}

function runTests(
  files: string[],
  options: { cleanup?: boolean; concurrency?: number } = {}
): Promise<string> {
  return new Promise((resolve) => {
    const args: string[] = ["src/test-runner/index.ts"];

    if (options.cleanup) args.push("--cleanup");
    if (options.concurrency) args.push(`--concurrency=${options.concurrency}`);
    args.push(...files);

    const output: string[] = [];

    log(`Spawning: npx tsx ${args.join(" ")}`);

    const child = spawn("npx", ["tsx", ...args], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, NODE_ENV: "test" },
      shell: false,
    });

    child.stdout.on("data", (chunk: Buffer) => {
      const line = chunk.toString();
      output.push(line);
      // Mirror to stderr so it's visible in MCP output panel
      process.stderr.write(`[runner] ${line}`);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      output.push(chunk.toString());
    });

    child.on("close", (code) => {
      output.push(`\nProcess exited with code ${code}`);
      resolve(output.join(""));
    });

    child.on("error", (err) => {
      resolve(`Failed to start test runner: ${err.message}`);
    });
  });
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "test-runner-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool: list_tests ─────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_tests",
        description:
          "List all available test files. Filter by module (e.g. 'matching', 'booking') or type ('module' | 'journey'). Returns testId, scenarioName, artifactStatus, and file path for each test.",
        inputSchema: {
          type: "object",
          properties: {
            module: {
              type: "string",
              description: `Filter by module name. One of: ${KNOWN_MODULES.join(", ")}`,
              enum: [...KNOWN_MODULES, "journey"],
            },
            type: {
              type: "string",
              description: "Filter by test type: 'module' or 'journey'",
              enum: ["module", "journey"],
            },
          },
        },
      },
      {
        name: "run_tests",
        description:
          "Run one or more test files by path. Pass explicit file paths or use run_module for convenience. Returns combined stdout output from the runner including pass/fail per test.",
        inputSchema: {
          type: "object",
          required: ["files"],
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
              description: "Array of absolute or relative file paths to test JSON files",
            },
            cleanup: {
              type: "boolean",
              description: "Pass --cleanup flag to runner (deletes test data after run). Default: false",
            },
            concurrency: {
              type: "number",
              description: "Max parallel tests for module tests. Default: CPU cores - 1",
            },
          },
        },
      },
      {
        name: "run_module",
        description:
          "Run all tests for a specific module in parallel. Equivalent to passing all __tests__/*.json files for that module to the runner.",
        inputSchema: {
          type: "object",
          required: ["module"],
          properties: {
            module: {
              type: "string",
              description: `Module to run. One of: ${KNOWN_MODULES.join(", ")}`,
              enum: KNOWN_MODULES,
            },
            cleanup: {
              type: "boolean",
              description: "Pass --cleanup flag to runner. Default: false",
            },
          },
        },
      },
      {
        name: "get_last_result",
        description:
          "Get the most recent result JSON for a specific test by testId (e.g. 'MOD-MATCHING-003'). Returns the full result report including status, stepResults, assertionSummary, and failures.",
        inputSchema: {
          type: "object",
          required: ["testId"],
          properties: {
            testId: {
              type: "string",
              description: "The testId from the test definition file, e.g. MOD-MATCHING-003 or JRN-006",
            },
          },
        },
      },
      {
        name: "get_environment_status",
        description:
          "Check whether all required services (API server, database, Docker, Mailpit) are running. Returns status per service plus fix instructions for anything that is down.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_test_summary",
        description:
          "Get a pass/fail summary across all tests for a module, or all modules if none specified. Shows which tests have results, which are pending (no result file yet), and last run status.",
        inputSchema: {
          type: "object",
          properties: {
            module: {
              type: "string",
              description: `Module to summarise. One of: ${KNOWN_MODULES.join(", ")}. Omit for all modules.`,
              enum: KNOWN_MODULES,
            },
          },
        },
      },
    ],
  };
});

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  log(`Tool called: ${name} | args: ${JSON.stringify(args)}`);

  // ── list_tests ──
  if (name === "list_tests") {
    const filterModule = args.module as string | undefined;
    const filterType = args.type as string | undefined;

    let tests: TestFile[] = [];

    if (!filterType || filterType === "module") {
      const modulesToScan = filterModule && filterModule !== "journey"
        ? [filterModule as Module]
        : KNOWN_MODULES;
      for (const mod of modulesToScan) {
        tests.push(...discoverModuleTests(mod));
      }
    }

    if (!filterType || filterType === "journey") {
      if (!filterModule || filterModule === "journey") {
        tests.push(...discoverJourneyTests());
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: tests.length,
              tests: tests.map((t) => ({
                testId: t.testId,
                scenarioName: t.scenarioName,
                artifactStatus: t.artifactStatus,
                type: t.type,
                module: t.module,
                path: t.path,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // ── run_tests ──
  if (name === "run_tests") {
    const files = (args.files as string[]) ?? [];
    if (files.length === 0) {
      return {
        content: [{ type: "text", text: "Error: no files provided. Pass an array of test file paths." }],
      };
    }

    const output = await runTests(files, {
      cleanup: args.cleanup as boolean | undefined,
      concurrency: args.concurrency as number | undefined,
    });

    return { content: [{ type: "text", text: output }] };
  }

  // ── run_module ──
  if (name === "run_module") {
    const module = args.module as Module;
    const tests = discoverModuleTests(module);

    if (tests.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No test files found for module '${module}' at ${moduleTestsDir(module)}`,
          },
        ],
      };
    }

    const files = tests.map((t) => t.path);
    const output = await runTests(files, {
      cleanup: args.cleanup as boolean | undefined,
    });

    return { content: [{ type: "text", text: `Running ${files.length} test(s) for module '${module}':\n\n${output}` }] };
  }

  // ── get_last_result ──
  if (name === "get_last_result") {
    const testId = args.testId as string;
    const result = getLastResult(testId);

    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: `No result file found for testId '${testId}'. Run the test first using run_tests or run_module.`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // ── get_environment_status ──
  if (name === "get_environment_status") {
    const status = await checkEnvironmentStatus();

    const allOk = status.api === "OK" && status.db === "OK" && status.mailpit === "OK";

    const summary = [
      `API Server:  ${status.api}`,
      `Database:    ${status.db}`,
      `Docker:      ${status.docker}`,
      `Mailpit:     ${status.mailpit}`,
      "",
      allOk ? "✅ All services ready — tests can run." : "❌ Some services are down.",
      "",
      ...Object.values(status.details).map((d) => `  Fix: ${d}`),
    ].join("\n");

    return { content: [{ type: "text", text: summary }] };
  }

  // ── get_test_summary ──
  if (name === "get_test_summary") {
    const filterModule = args.module as Module | undefined;
    const modulesToScan = filterModule ? [filterModule] : KNOWN_MODULES;

    const rows: Array<{
      module: string;
      testId: string;
      scenarioName: string;
      lastStatus: string;
      hasResult: boolean;
    }> = [];

    for (const mod of modulesToScan) {
      const tests = discoverModuleTests(mod);
      for (const t of tests) {
        const result = getLastResult(t.testId);
        rows.push({
          module: mod,
          testId: t.testId,
          scenarioName: t.scenarioName,
          lastStatus: result ? (result.status as string) : "NO_RESULT",
          hasResult: result !== null,
        });
      }
    }

    const pass = rows.filter((r) => r.lastStatus === "PASS").length;
    const fail = rows.filter((r) => r.lastStatus === "FAIL").length;
    const noResult = rows.filter((r) => !r.hasResult).length;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              summary: { total: rows.length, pass, fail, noResult },
              tests: rows,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("test-runner-mcp started on stdio transport");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
