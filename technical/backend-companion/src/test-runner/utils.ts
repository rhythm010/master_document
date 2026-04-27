import type { RunContext } from "./types";

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Return ISO-8601 timestamp in UTC. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Build a run id that includes UTC timestamp and test id. */
export function makeRunId(testId: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `RUN-${stamp}-${testId}`;
}

/** Return a short run suffix for template placeholders. */
export function makeRunSuffix(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

/** Render {{TOKEN}} placeholders in a string using context values. */
export function renderTemplate(value: string, context: RunContext): string {
  if (!value.includes("{{")) {
    return value;
  }

  return value.replace(/\{\{([^}]+)\}\}/g, (match, token) => {
    const key = String(token).trim();
    const replacement = context[key];
    if (replacement === undefined || replacement === null) {
      return match;
    }
    return String(replacement);
  });
}

/** Recursively substitute templates within objects, arrays, and strings. */
export function substitute<T>(value: T, context: RunContext): T {
  if (typeof value === "string") {
    return renderTemplate(value, context) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => substitute(entry, context)) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = substitute(entry, context);
    }
    return output as T;
  }
  return value;
}

/** Safely read a dotted path from a plain object. */
export function deepGet(obj: unknown, dottedPath: string): unknown {
  if (!dottedPath) {
    return undefined;
  }
  const parts = dottedPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Ensure table or column identifiers are safe to embed in SQL. */
export function assertSafeIdentifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Unsafe ${label} identifier: ${value}`);
  }
  return value;
}

/** Pause execution for the provided number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Decode quoted-printable body while preserving ASCII content. */
export function decodeQuotedPrintable(input: string): string {
  const withoutSoftBreaks = input.replace(/=\r\n/g, "").replace(/=\n/g, "");
  return withoutSoftBreaks.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => {
    const code = parseInt(hex, 16);
    if (Number.isNaN(code)) {
      return _;
    }
    return String.fromCharCode(code);
  });
}

/** Parse CLI arguments for cleanup flag and test file paths. */
export function parseArgs(argv: string[]): { cleanup: boolean; files: string[] } {
  const files: string[] = [];
  let cleanup = false;

  for (const arg of argv) {
    if (arg === "--cleanup") {
      cleanup = true;
    } else {
      files.push(arg);
    }
  }

  return { cleanup, files };
}
