#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const VALID_SERVERS = new Set([
  "project-context-mcp",
  "project-context-mcp-fe",
  "test-runner-mcp",
]);

const serverName = process.argv[2];

function log(message) {
  process.stderr.write(`[mcp-launcher] ${message}\n`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "ignore", "inherit"],
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

if (!VALID_SERVERS.has(serverName)) {
  log(`Unknown server '${serverName ?? ""}'. Expected one of: ${Array.from(VALID_SERVERS).join(", ")}`);
  process.exit(1);
}

const mcpRoot = dirname(fileURLToPath(import.meta.url));
const serverDir = join(mcpRoot, serverName);
const packageJson = join(serverDir, "package.json");
const lockFile = join(serverDir, "package-lock.json");
const entrypoint = join(serverDir, "dist", "index.js");
const sdkDependency = join(serverDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json");

try {
  if (!existsSync(packageJson)) {
    throw new Error(`Missing ${packageJson}. This worktree does not contain the '${serverName}' MCP package.`);
  }

  if (!existsSync(sdkDependency)) {
    log(`${serverName}: installing dependencies because node_modules is missing`);
    run("npm", [existsSync(lockFile) ? "ci" : "install"], serverDir);
  }

  if (!existsSync(entrypoint)) {
    log(`${serverName}: building because dist/index.js is missing`);
    run("npm", ["run", "build"], serverDir);
  }

  const result = spawnSync(process.execPath, [entrypoint], {
    cwd: serverDir,
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 0);
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
