import type {
  AssertionsDefinition,
  AssertionSummary,
  RunContext,
  StepResult
} from "./types";
import { substitute } from "./utils";

const DEFAULT_SUMMARY: AssertionSummary = {
  api: "PASS",
  db: "PASS",
  external: "PASS",
  mustNotOccur: "PASS"
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function subsetMatches(expected: unknown, observed: unknown): boolean {
  if (isObject(expected)) {
    if (!isObject(observed)) {
      return false;
    }
    return Object.entries(expected).every(([key, value]) => subsetMatches(value, observed[key]));
  }

  if (Array.isArray(expected)) {
    return Array.isArray(observed) && expected.length === observed.length &&
      expected.every((value, index) => subsetMatches(value, observed[index]));
  }

  return expected === observed;
}

function findStepResult(stepResults: StepResult[], step: number): StepResult | undefined {
  return stepResults.find((result) => result.step === step);
}

/** Evaluate api, db, and external assertions and return a summary. */
export function evaluateAssertions(
  assertions: AssertionsDefinition | undefined,
  stepResults: StepResult[],
  context: RunContext
): AssertionSummary {
  if (!assertions) {
    return { ...DEFAULT_SUMMARY };
  }

  const summary: AssertionSummary = { ...DEFAULT_SUMMARY };

  if (assertions.api && assertions.api.length > 0) {
    summary.api = assertions.api.every((assertion) => {
      const stepResult = findStepResult(stepResults, assertion.step);
      if (!stepResult) {
        return false;
      }
      if (assertion.statusCode !== undefined && stepResult.statusCode !== assertion.statusCode) {
        return false;
      }
      if (assertion.requiredKeys && assertion.requiredKeys.length > 0) {
        if (!isObject(stepResult.observed)) {
          return false;
        }
        for (const key of assertion.requiredKeys) {
          if (!(key in stepResult.observed)) {
            return false;
          }
        }
      }

      if (assertion.bodyFields) {
        const expected = substitute(assertion.bodyFields, context) as Record<string, unknown>;
        if (!subsetMatches(expected, stepResult.observed)) {
          return false;
        }
      }

      return true;
    })
      ? "PASS"
      : "FAIL";
  }

  if (assertions.external && assertions.external.length > 0) {
    summary.external = assertions.external.every((assertion) => {
      const stepResult = findStepResult(stepResults, assertion.step);
      if (!stepResult) {
        return false;
      }
      const observed = stepResult.observed as Record<string, unknown>;
      if (!observed.emailFound) {
        return false;
      }
      const checks = assertion.checks || [];
      const requiresToken = checks.some((check) => check.toLowerCase().includes("token"));
      if (requiresToken && !observed.tokenExtracted) {
        return false;
      }
      return true;
    })
      ? "PASS"
      : "FAIL";
  }

  if (assertions.db && assertions.db.length > 0) {
    summary.db = assertions.db.every((assertion) => {
      const stepResult = findStepResult(stepResults, assertion.step);
      if (!stepResult) {
        return false;
      }
      const observed = stepResult.observed as Record<string, unknown>;
      const rows = Array.isArray(observed.rows) ? observed.rows : [];
      const checks = assertion.checks || [];
      if (checks.some((check) => check.includes("no row exists"))) {
        return rows.length === 0;
      }
      if (checks.some((check) => check.includes("at least 1 row exists"))) {
        return rows.length > 0;
      }
      if (checks.some((check) => check.includes("row exists"))) {
        return rows.length > 0;
      }
      return true;
    })
      ? "PASS"
      : "FAIL";
  }

  return summary;
}
