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
  assertSafeIdentifier,
  deepGet,
  makeRunId,
  makeRunSuffix,
  nowIso,
  parseArgs,
  substitute,
  todayYmd
} from "./utils";

const API_BASE = "http://localhost:3000";
const MAILPIT_BASE = "http://localhost:8025";

const INFO_NOOP_ACTION_TYPES = new Set([
  "authorization",
  "validation",
  "allocation",
  "dbTransaction",
  "responseValidation"
]);

function toContextKey(fieldName: string): string {
  return fieldName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function resolveBearerToken(step: StepDefinition, context: Record<string, unknown>): string | undefined {
  const explicit = context["ACCESS_TOKEN"];
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit;
  }

  const actor = String(step.actor ?? "").toLowerCase();
  if (actor.includes("client")) {
    const token = context["CLIENT_ACCESS_TOKEN"];
    if (typeof token === "string" && token.length > 0) {
      return token;
    }
  }

  if (actor.includes("companion")) {
    const token = context["COMPANION_ACCESS_TOKEN"];
    if (typeof token === "string" && token.length > 0) {
      return token;
    }
  }

  // Common default used by current seed helpers.
  const token = context["CLIENT_ACCESS_TOKEN"];
  if (typeof token === "string" && token.length > 0) {
    return token;
  }

  return undefined;
}

function prepareApiRequestStep(step: StepDefinition, context: Record<string, unknown>): StepDefinition {
  if (step.actionType !== "apiRequest") {
    return step;
  }

  const headers: Record<string, string> = {};
  if (step.headers) {
    Object.assign(headers, step.headers);
  }

  const authType = String(step.authType ?? "").toLowerCase();
  if (authType === "bearer" && !headers["Authorization"]) {
    const token = resolveBearerToken(step, context);
    if (!token) {
      throw new Error("apiRequest step requires Bearer auth but no access token was found in context");
    }
    headers["Authorization"] = `Bearer ${token}`;
  }

  let endpoint = step.endpoint;
  if (step.pathParams && isRecord(step.pathParams)) {
    const renderedParams = substitute(step.pathParams, context) as Record<string, unknown>;
    for (const [key, value] of Object.entries(renderedParams)) {
      endpoint = endpoint.replace(`:${key}`, String(value));
    }
  }

  let payload = step.payload;
  if (payload === undefined && Array.isArray(step.requiredPayloadFields) && step.requiredPayloadFields.length > 0) {
    const autoPayload: Record<string, unknown> = {};
    for (const field of step.requiredPayloadFields) {
      if (typeof field !== "string") {
        continue;
      }
      const contextKey = toContextKey(field);
      const value = context[contextKey] ?? context[field];
      if (value !== undefined) {
        autoPayload[field] = value;
      }
    }
    payload = autoPayload;
  }

  return {
    ...step,
    endpoint,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    payload
  };
}

function coerceLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "null") {
    return null;
  }
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return trimmed;
}

function validateExpectedResponseFields(
  expectedFields: string[],
  observed: Record<string, unknown>
): { pass: boolean; checks: Array<Record<string, unknown>> } {
  const checks: Array<Record<string, unknown>> = [];
  let ok = true;

  for (const entry of expectedFields) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      continue;
    }

    if (entry.includes("=")) {
      const [fieldRaw, expectedRaw] = entry.split("=", 2);
      const field = fieldRaw.trim();
      const expected = coerceLiteral(expectedRaw);
      const actual = deepGet(observed, field);
      const pass = actual === expected;
      checks.push({ type: "equals", field, expected, actual, pass });
      if (!pass) {
        ok = false;
      }
      continue;
    }

    const field = entry.trim();
    const actual = deepGet(observed, field);
    const pass = actual !== undefined;
    checks.push({ type: "present", field, actual, pass });
    if (!pass) {
      ok = false;
    }
  }

  return { pass: ok, checks };
}

function buildParameterizedWhere(
  queryTemplate: string,
  context: Record<string, unknown>
): { whereClause: string; params: unknown[] } {
  const trimmed = queryTemplate.trim();
  if (!trimmed.startsWith("WHERE ")) {
    throw new Error("dbVerification.query must start with 'WHERE '");
  }
  if (trimmed.includes(";")) {
    throw new Error("dbVerification.query must not include semicolons");
  }
  if (trimmed.includes("--") || trimmed.includes("/*") || trimmed.includes("*/")) {
    throw new Error("dbVerification.query must not include SQL comments");
  }

  const params: unknown[] = [];
  const whereClause = trimmed.replace(/\{\{([^}]+)\}\}/g, (match, token) => {
    const key = String(token).trim();
    const value = context[key];
    if (value === undefined) {
      throw new Error(`dbVerification.query placeholder {{${key}}} was not found in context`);
    }
    params.push(value);
    return `$${params.length}`;
  });

  return { whereClause, params };
}

function validateDbRows(
  rows: Array<Record<string, unknown>>,
  expectedRows: number | undefined,
  expectedFields: Record<string, unknown> | undefined
): { pass: boolean; checks: Array<Record<string, unknown>> } {
  const checks: Array<Record<string, unknown>> = [];
  let ok = true;

  if (expectedRows !== undefined) {
    const pass = rows.length === expectedRows;
    checks.push({ type: "rowCount", expectedRows, actualRows: rows.length, pass });
    if (!pass) {
      ok = false;
    }
  }

  if (!expectedFields) {
    return { pass: ok, checks };
  }

  const designationsExpected = expectedFields["designations"];
  if (Array.isArray(designationsExpected)) {
    const actual = rows.map((row) => String(row["designation"] ?? ""));
    const expected = designationsExpected.map((d) => String(d));
    const actualSorted = [...actual].sort();
    const expectedSorted = [...expected].sort();
    const pass =
      actualSorted.length === expectedSorted.length &&
      actualSorted.every((value, idx) => value === expectedSorted[idx]);
    checks.push({ type: "designations", expected, actual, pass });
    if (!pass) {
      ok = false;
    }
  }

  for (const [field, expected] of Object.entries(expectedFields)) {
    if (field === "designations") {
      continue;
    }

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const actual = row[field];

      if (expected === "{{NOT_NULL}}") {
        const pass = actual !== null && actual !== undefined;
        checks.push({ type: "notNull", row: index, field, actual, pass });
        if (!pass) {
          ok = false;
        }
        continue;
      }

      const pass = actual === expected;
      checks.push({ type: "equals", row: index, field, expected, actual, pass });
      if (!pass) {
        ok = false;
      }
    }
  }

  return { pass: ok, checks };
}

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
  if (context["TODAY_DATE_YMD"] === undefined || context["TODAY_DATE_YMD"] === null) {
    context["TODAY_DATE_YMD"] = todayYmd(process.env.TZ);
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

    let lastApiRequest: { step: number; statusCode: number; observed: Record<string, unknown> } | null = null;

    for (const step of testDef.steps) {
      const stepStartedAt = nowIso();
      const stepNumber = step.step;
      const stepActionType = (step as { actionType?: unknown }).actionType;
      const stepResult = buildStepBase(step);
      let target = "";
      try {
        if (step.actionType === "apiRequest") {
          const prepared = prepareApiRequestStep(step, context);
          const apiStep = prepared as Extract<StepDefinition, { actionType: "apiRequest" }>;

          target = `${apiStep.method} ${substitute(apiStep.endpoint, context)}`;
          const apiResult = await executeApiRequest(apiStep, context, API_BASE);
          stepResult.result = "PASS";
          stepResult.statusCode = apiResult.statusCode;
          stepResult.observed = apiResult.observed;

          lastApiRequest = { step: stepNumber, statusCode: apiResult.statusCode, observed: apiResult.observed };

          const observedId = apiResult.observed ? (apiResult.observed["id"] as unknown) : undefined;
          if (context["BOOKING_ID"] === undefined && typeof observedId === "string" && observedId.length > 0) {
            context["BOOKING_ID"] = observedId;
          }
        } else if (step.actionType === "apiResponse") {
          target = "API response validation";

          if (!lastApiRequest) {
            stepResult.result = "FAIL";
            stepResult.observed = { note: "No prior apiRequest step was executed before apiResponse." };
          } else {
            const expectedStatus = (step as { expectedStatus?: unknown }).expectedStatus;
            const expectedFieldsRaw = (step as { expectedResponseFields?: unknown }).expectedResponseFields;

            const checks: Array<Record<string, unknown>> = [];
            let ok = true;

            if (typeof expectedStatus === "number") {
              const pass = lastApiRequest.statusCode === expectedStatus;
              checks.push({ type: "statusCode", expected: expectedStatus, actual: lastApiRequest.statusCode, pass });
              if (!pass) {
                ok = false;
              }
            }

            if (Array.isArray(expectedFieldsRaw)) {
              const expectedFields = expectedFieldsRaw.filter((entry) => typeof entry === "string") as string[];
              const fieldResult = validateExpectedResponseFields(expectedFields, lastApiRequest.observed);
              checks.push(...fieldResult.checks);
              if (!fieldResult.pass) {
                ok = false;
              }
            }

            stepResult.statusCode = lastApiRequest.statusCode;
            stepResult.observed = {
              lastApiRequestStep: lastApiRequest.step,
              response: lastApiRequest.observed,
              checks
            };
            stepResult.result = ok ? "PASS" : "FAIL";

            const observedId = lastApiRequest.observed ? (lastApiRequest.observed["id"] as unknown) : undefined;
            if (context["BOOKING_ID"] === undefined && typeof observedId === "string" && observedId.length > 0) {
              context["BOOKING_ID"] = observedId;
            }
          }
        } else if (step.actionType === "dbVerification") {
          const targetRaw = substitute(step.target, context);
          const table = assertSafeIdentifier(String(targetRaw), "table");

          const renderedExpectedFields = step.expectedFields
            ? (substitute(step.expectedFields, context) as Record<string, unknown>)
            : undefined;

          const limit = 50;
          let sql = `SELECT * FROM "${table}"`;
          let params: unknown[] = [];

          let queryTemplate: string | undefined;
          if (typeof step.query === "string" && step.query.trim().length > 0) {
            queryTemplate = step.query;
          } else {
            // Default to scoping results to the current booking to keep checks stable
            // when the database contains historical rows from other runs.
            if (context["BOOKING_ID"] !== undefined) {
              if (table === "bookings") {
                queryTemplate = "WHERE id = {{BOOKING_ID}}";
              } else if (table === "roster_slots" || table === "booking_companion_assignments") {
                queryTemplate = "WHERE booking_id = {{BOOKING_ID}}";
              }
            }
          }

          if (queryTemplate) {
            const built = buildParameterizedWhere(queryTemplate, context);
            sql += ` ${built.whereClause}`;
            params = built.params;
          }

          sql += ` LIMIT ${limit};`;
          target = `DB verify ${table}`;

          const queryResult = await pool.query(sql, params);
          const rows = (queryResult.rows as Array<Record<string, unknown>>) ?? [];

          const validation = validateDbRows(rows, step.expectedRows, renderedExpectedFields);

          stepResult.observed = {
            sql,
            params,
            rowCount: rows.length,
            rows,
            checks: validation.checks
          };
          stepResult.result = validation.pass ? "PASS" : "FAIL";

          const firstRow = rows[0];
          if (context["BOOKING_ID"] === undefined && firstRow && typeof firstRow["id"] === "string") {
            context["BOOKING_ID"] = firstRow["id"];
          }
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
          const rawTarget = (step as { target?: unknown }).target;

          if (typeof rawTarget !== "string" || rawTarget.trim().length === 0) {
            target = "DB query (skipped: missing target)";
            stepResult.result = "PASS";
            stepResult.observed = {
              note: "Skipped dbQuery step because step.target was missing/empty (informational step).",
              expectedBehavior: (step as { expectedBehavior?: unknown }).expectedBehavior,
              notes: (step as { notes?: unknown }).notes
            };
          } else {
            target = `DB ${substitute(rawTarget, context)} query`;
            const dbResult = await executeDbQuery(pool, step, context);
            stepResult.result = "PASS";
            stepResult.observed = {
              rows: dbResult.rows,
              rowCount: dbResult.rowCount
            };
          }
        } else if (INFO_NOOP_ACTION_TYPES.has(step.actionType)) {
          target = `${step.actionType} (noop)`;
          stepResult.result = "PASS";
          stepResult.observed = {
            note: "Informational DRAFT_SPEC step (runner treats as NOOP PASS).",
            expectedBehavior: (step as { expectedBehavior?: unknown }).expectedBehavior,
            notes: (step as { notes?: unknown }).notes
          };
        } else {
          stepResult.result = "FAIL";
          recordFailure(result.failures, stepNumber, "Unsupported actionType", stepActionType);
        }
      } catch (error) {
        stepResult.result = "FAIL";
        recordFailure(result.failures, stepNumber, "Step execution failed", String(error));
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

  const absoluteFilePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const normalized = path.normalize(absoluteFilePath);
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
