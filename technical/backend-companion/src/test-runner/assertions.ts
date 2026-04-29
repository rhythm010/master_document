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

  const rawApiAssertions = assertions.api as unknown;
  if (Array.isArray(rawApiAssertions) && rawApiAssertions.length > 0) {
    const apiAssertions = rawApiAssertions.filter(
      (entry): entry is { step: number; statusCode?: number; requiredKeys?: string[]; bodyFields?: Record<string, unknown> } =>
        isObject(entry) && typeof entry.step === "number"
    );

    // DRAFT_SPEC tests often store narrative strings in assertions.api; ignore them.
    if (apiAssertions.length > 0) {
      summary.api = apiAssertions.every((assertion) => {
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
  }

  const rawExternalAssertions = assertions.external as unknown;
  if (Array.isArray(rawExternalAssertions) && rawExternalAssertions.length > 0) {
    const externalAssertions = rawExternalAssertions.filter(
      (entry): entry is { step: number; checks?: string[] } => isObject(entry) && typeof entry.step === "number"
    );

    // DRAFT_SPEC tests may store narrative strings in assertions.external; ignore them.
    if (externalAssertions.length > 0) {
      summary.external = externalAssertions.every((assertion) => {
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
  }

  const rawDbAssertions = assertions.db as unknown;
  if (Array.isArray(rawDbAssertions) && rawDbAssertions.length > 0) {
    const dbAssertions = rawDbAssertions.filter(
      (entry): entry is { step: number; checks?: string[] } => isObject(entry) && typeof entry.step === "number"
    );

    // DRAFT_SPEC tests may store narrative strings in assertions.db; ignore them.
    if (dbAssertions.length > 0) {
      summary.db = dbAssertions.every((assertion) => {
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
  }

  return summary;
}
