import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

// Load test environment if .env.test exists
const envTestPath = path.resolve(__dirname, "../../.env.test");
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
  console.log("✓ Loaded test environment from .env.test");
} else {
  console.log("⚠ .env.test not found, using default environment");
  console.log("  To fix: Copy .env.test.example to .env.test and update tokens");
}

import { config } from "./config";
import { checkDatabase, getSharedPool, closeSharedPool } from "./db";
import { checkApiHealth, checkMailpitHealth } from "./http";
import { parseRunnerArgs, readTestDefinition, resolveResultsDir, runTestFile } from "./runner";
import type { EnvironmentCheck } from "./types";

// Production guard
if (config.environment.nodeEnv === "production") {
  console.error("❌ ERROR: Test runner cannot execute in production environment.");
  console.error('Set NODE_ENV to "development" or "test" to run tests.');
  process.exit(1);
}

function printUsage(): void {
  console.log("Usage: npx tsx src/test-runner/index.ts [--cleanup] [--concurrency=N] <test1.json> <test2.json>");
}

function initEnvironmentCheck(): EnvironmentCheck {
  return {
    apiServer: "PENDING",
    database: "PENDING",
    mailpit: "PENDING"
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check for custom concurrency (store in local variable to avoid mutating shared config)
  let concurrency = config.execution.concurrency;
  const concurrencyArg = args.find(arg => arg.startsWith("--concurrency="));
  if (concurrencyArg) {
    const customConcurrency = parseInt(concurrencyArg.split("=")[1]);
    if (!isNaN(customConcurrency) && customConcurrency > 0) {
      concurrency = Math.min(customConcurrency, config.execution.maxConcurrency);
    }
    // Remove the concurrency arg from the list
    args.splice(args.indexOf(concurrencyArg), 1);
  }
  
  const { cleanup, files } = parseRunnerArgs(args);

  if (files.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  // Verify DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is not set");
    process.exitCode = 1;
    return;
  }

  // Create shared database pool
  const pool = getSharedPool(process.env.DATABASE_URL);
  
  // Ensure cleanup on signal interrupts
  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM, cleaning up...");
    await closeSharedPool();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("Received SIGINT, cleaning up...");
    await closeSharedPool();
    process.exit(0);
  });

  try {
    // Run environment checks once at startup (WU-07: Cache environment checks)
    // PERFORMANCE: Parallelized health checks to save 50-100ms per test run
    console.log("🔍 Running environment checks...");
    const cachedEnvCheck = initEnvironmentCheck();
    const [apiStatus, dbStatus, mailpitStatus] = await Promise.all([
      checkApiHealth(config.api.baseUrl),
      checkDatabase(pool),
      checkMailpitHealth(config.mailpit.baseUrl),
    ]);
    cachedEnvCheck.apiServer = apiStatus;
    cachedEnvCheck.database = dbStatus;
    cachedEnvCheck.mailpit = mailpitStatus;

    if (cachedEnvCheck.apiServer === "FAIL") {
      console.error("❌ API server check failed");
      process.exitCode = 1;
      return;
    }
    if (cachedEnvCheck.database === "FAIL") {
      console.error("❌ Database check failed");
      process.exitCode = 1;
      return;
    }
    if (cachedEnvCheck.mailpit === "FAIL") {
      console.warn("⚠️  Mailpit check failed (some tests may skip email verification)");
    }

    console.log("✅ Environment checks passed\n");

    // WU-08: Categorize tests (ensure each test is categorized exactly once)
    const journeyTests = files.filter(f => (f.includes("/qa/") || f.startsWith("qa/")) && !f.includes("/__tests__/"));
    const moduleTests = files.filter(f => f.includes("/__tests__/"));

    // Validate all files are categorized
    const categorizedCount = journeyTests.length + moduleTests.length;
    if (categorizedCount !== files.length) {
      const uncategorized = files.filter(f => 
        !journeyTests.includes(f) && !moduleTests.includes(f)
      );
      console.warn(`⚠️  Warning: ${uncategorized.length} test files could not be categorized:`);
      uncategorized.forEach(f => console.warn(`   - ${f}`));
    }

    // Execute journey tests sequentially
    if (journeyTests.length > 0) {
      console.log(`📋 Running ${journeyTests.length} journey test(s) sequentially...`);
      for (const filePath of journeyTests) {
        if (!fs.existsSync(filePath)) {
          console.error(`Test file not found: ${filePath}`);
          continue;
        }

        const testDef = readTestDefinition(filePath);
        const resultsDir = resolveResultsDir(testDef, filePath);
        fs.mkdirSync(resultsDir, { recursive: true });

        console.log(`  Running: ${path.basename(filePath)}`);
        const report = await runTestFile(filePath, cleanup);
        const fileName = `${path.basename(filePath, ".json")}-result.json`;
        const resultPath = path.join(resultsDir, fileName);
        fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
        console.log(`    ${report.status === "PASS" ? "✅" : "❌"} ${report.status} - Report saved to: ${resultPath}`);
      }
      console.log("");
    }

    // Execute module tests in parallel with concurrency limit
    if (moduleTests.length > 0) {
      console.log(`📋 Running ${moduleTests.length} module test(s) in parallel (concurrency: ${concurrency})...`);
      
      // Helper function to chunk array
      function chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
          chunks.push(array.slice(i, i + size));
        }
        return chunks;
      }

      const chunks = chunkArray(moduleTests, concurrency);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (filePath) => {
            try {
              if (!fs.existsSync(filePath)) {
                console.error(`Test file not found: ${filePath}`);
                return;
              }

              const testDef = readTestDefinition(filePath);
              const resultsDir = resolveResultsDir(testDef, filePath);
              fs.mkdirSync(resultsDir, { recursive: true });

              console.log(`  Running: ${path.basename(filePath)}`);
              const report = await runTestFile(filePath, cleanup);
              const fileName = `${path.basename(filePath, ".json")}-result.json`;
              const resultPath = path.join(resultsDir, fileName);
              fs.writeFileSync(resultPath, JSON.stringify(report, null, 2));
              console.log(`    ${report.status === "PASS" ? "✅" : "❌"} ${report.status} - Report saved to: ${resultPath}`);
            } catch (error) {
              console.error(`❌ Error running test ${filePath}:`, error);
              // Create error report for this test
              const testDef = readTestDefinition(filePath);
              const resultsDir = resolveResultsDir(testDef, filePath);
              fs.mkdirSync(resultsDir, { recursive: true });
              const errorReport = {
                testFile: filePath,
                status: 'ERROR',
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date().toISOString(),
              };
              const fileName = `${path.basename(filePath, ".json")}-result.json`;
              const resultPath = path.join(resultsDir, fileName);
              fs.writeFileSync(resultPath, JSON.stringify(errorReport, null, 2));
            }
          })
        );
      }
      console.log("");
    }

    console.log("✅ All tests complete");
  } catch (error) {
    console.error("❌ Error during test execution:", error);
    process.exitCode = 1;
  } finally {
    // Close shared pool
    await closeSharedPool();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
