import fs from "node:fs";
import path from "node:path";

import type {
  AssertionSummary,
  EnvironmentCheck,
  StepDefinition,
  StepResult,
  TestDefinition,
  TestRunResult
} from "./types";
import { evaluateAssertions } from "./assertions";
import { applySeedData, checkDatabase, createDbPool, executeDbQuery } from "./db";
import { checkApiHealth, checkMailpitHealth, executeApiRequest } from "./http";
import { executeExternalCheck } from "./mailpit";
import {
  makeRunId,
  makeRunSuffix,
  nowIso,
  parseArgs,
  substitute
} from "./utils";

const API_BASE = "http://localhost:3000";
const MAILPIT_BASE = "http://localhost:8025";

function initEnvironmentCheck(): EnvironmentCheck {
  return { apiServer: "FAIL", mailpit: "FAIL", database: "FAIL" };
}

function buildStepBase(step: StepDefinition): StepResult {
  return {
    step: step.step,
    result: "PENDING",
    observed: {},
    actor: step.actor,
    actionType: step.actionType,
    description: step.description,
    layman: step.layman
  };
}

function shouldBlock(environmentCheck: EnvironmentCheck): boolean {
  return Object.values(environmentCheck).some((value) => value !== "OK");
}

function buildCleanupReport(cleanupRequested: boolean): Record<string, unknown> {
  if (!cleanupRequested) {
    return {
      status: "SKIPPED",
      reason: "Default behavior - cleanup not requested",
      actions: []
    };
  }

  return {
    status: "SKIPPED",
    reason: "Cleanup requested but no cleanup actions are configured",
    actions: []
  };
}

function recordFailure(
  failures: Array<Record<string, unknown>>,
  step: number | null,
  reason: string,
  evidence?: unknown
): void {
  failures.push({ step, reason, evidence });
}

function updateStatus(summary: AssertionSummary, failures: Array<Record<string, unknown>>): string {
  if (failures.length > 0) {
    return "FAIL";
  }
  const values = Object.values(summary);
  if (values.some((value) => value !== "PASS")) {
    return "FAIL";
  }
  return "PASS";
}

/** Execute a single JSON test file and return the report. */
export async function runTestFile(
  filePath: string,
  cleanupRequested: boolean
): Promise<TestRunResult> {
  const fileContents = fs.readFileSync(filePath, "utf-8");
  const testDef = JSON.parse(fileContents) as TestDefinition;
  const runId = makeRunId(testDef.testId);
  const startedAt = nowIso();
  const environmentCheck = initEnvironmentCheck();

  const result: TestRunResult = {
    runId,
    testId: testDef.testId,
    status: "PENDING",
    startedAt,
    endedAt: startedAt,
    environmentCheck,
    serviceHitLog: [],
    stepResults: [],
    assertionSummary: {
      api: "PASS",
      db: "PASS",
      external: "PASS",
      mustNotOccur: "PASS"
    },
    failures: [],
    cleanup: buildCleanupReport(cleanupRequested)
  };

  const context: Record<string, unknown> = {
    RUN_ID: makeRunSuffix()
  };
  for (const [key, value] of Object.entries(process.env)) {
    context[key] = value;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    environmentCheck.database = "FAIL";
    environmentCheck.apiServer = await checkApiHealth(API_BASE);
    environmentCheck.mailpit = await checkMailpitHealth(MAILPIT_BASE);
    recordFailure(result.failures, null, "DATABASE_URL is not set");
    result.status = "BLOCKED";
    result.endedAt = nowIso();
    return result;
  }

  const pool = createDbPool(databaseUrl);
  try {
    environmentCheck.apiServer = await checkApiHealth(API_BASE);
    environmentCheck.mailpit = await checkMailpitHealth(MAILPIT_BASE);
    environmentCheck.database = await checkDatabase(pool);

    if (shouldBlock(environmentCheck)) {
      recordFailure(result.failures, null, "Environment not ready", environmentCheck);
      result.status = "BLOCKED";
      result.endedAt = nowIso();
      return result;
    }

    try {
      await applySeedData(pool, testDef.seedData, context);
    } catch (error) {
      recordFailure(result.failures, null, "Seed data failed", String(error));
      result.status = "FAIL";
      result.endedAt = nowIso();
      return result;
    }

    for (const step of testDef.steps) {
      const stepStartedAt = nowIso();
      const stepResult = buildStepBase(step);
      let target = "";
      try {
        if (step.actionType === "apiRequest") {
          target = `${step.method} ${substitute(step.endpoint, context)}`;
          const apiResult = await executeApiRequest(step, context, API_BASE);
          stepResult.result = "PASS";
          stepResult.statusCode = apiResult.statusCode;
          stepResult.observed = apiResult.observed;
        } else if (step.actionType === "externalCheck") {
          target = step.endpoint ? String(substitute(step.endpoint, context)) : `${MAILPIT_BASE}/api/v1/messages`;
          const externalResult = await executeExternalCheck(
            step,
            context,
            MAILPIT_BASE,
            testDef.waitPolicy
          );
          const requiresToken = Boolean(step.extractTokenFromEmail);
          const tokenOk = requiresToken ? Boolean(externalResult.observed.tokenExtracted) : true;
          stepResult.result = externalResult.observed.emailFound && tokenOk ? "PASS" : "FAIL";
          stepResult.observed = externalResult.observed;
        } else if (step.actionType === "dbQuery") {
          target = `DB ${substitute(step.target, context)} query`;
          const dbResult = await executeDbQuery(pool, step, context);
          stepResult.result = "PASS";
          stepResult.observed = {
            rows: dbResult.rows,
            rowCount: dbResult.rowCount
          };
        } else {
          stepResult.result = "FAIL";
          recordFailure(result.failures, step.step, "Unsupported actionType", step.actionType);
        }
      } catch (error) {
        stepResult.result = "FAIL";
        recordFailure(result.failures, step.step, "Step execution failed", String(error));
      }

      const stepEndedAt = nowIso();
      const durationMs = new Date(stepEndedAt).getTime() - new Date(stepStartedAt).getTime();
      stepResult.serviceHit = {
        step: step.step,
        target,
        startedAt: stepStartedAt,
        endedAt: stepEndedAt,
        durationMs,
        result: stepResult.result,
        statusCode: stepResult.statusCode
      };

      result.stepResults.push(stepResult);
      result.serviceHitLog.push(stepResult.serviceHit);

      if (stepResult.result !== "PASS") {
        recordFailure(result.failures, step.step, "Step failed", stepResult.observed);
      }
    }

    result.assertionSummary = evaluateAssertions(testDef.assertions, result.stepResults, context);
    result.status = updateStatus(result.assertionSummary, result.failures);
    result.endedAt = nowIso();
    return result;
  } finally {
    await pool.end();
  }
}

/** Resolve a results directory based on the testId and file path. */
export function resolveResultsDir(testDef: TestDefinition, filePath: string): string {
  const baseDir = path.resolve(__dirname, "..", "..");
  const testId = testDef.testId || path.basename(filePath, ".json");
  const fileName = path.basename(filePath);
  const isJourney = testDef.type === "journey" || testId.startsWith("JRN-") || fileName.startsWith("JRN-");

  if (isJourney) {
    return path.join(baseDir, "results");
  }

  const normalized = path.normalize(filePath);
  const marker = `${path.sep}src${path.sep}modules${path.sep}`;
  const testsMarker = `${path.sep}__tests__${path.sep}`;
  const start = normalized.indexOf(marker);
  const end = normalized.indexOf(testsMarker);

  if (start !== -1 && end !== -1 && end > start) {
    const modulePath = normalized.slice(start + marker.length, end);
    const moduleName = modulePath.split(path.sep)[0];
    return path.join(baseDir, "src", "modules", moduleName, "__tests__", "results");
  }

  return path.join(baseDir, "src", "modules", "identity", "__tests__", "results");
}

/** Read test definition from disk. */
export function readTestDefinition(filePath: string): TestDefinition {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as TestDefinition;
}

/** Parse CLI arguments for the test runner. */
export function parseRunnerArgs(argv: string[]): { cleanup: boolean; files: string[] } {
  return parseArgs(argv);
}
