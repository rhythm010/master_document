import type { ApiRequestStep, RunContext } from "./types";
import { deepGet, substitute } from "./utils";

/** Check API health endpoint availability. */
export async function checkApiHealth(apiBase: string): Promise<string> {
  try {
    const response = await fetch(`${apiBase}/health`);
    return response.ok ? "OK" : "FAIL";
  } catch (error) {
    return "FAIL";
  }
}

/** Check Mailpit list endpoint availability. */
export async function checkMailpitHealth(mailpitBase: string): Promise<string> {
  try {
    const response = await fetch(`${mailpitBase}/api/v1/messages`);
    return response.ok ? "OK" : "FAIL";
  } catch (error) {
    return "FAIL";
  }
}

/** Execute an apiRequest step and store response fields in context. */
export async function executeApiRequest(
  step: ApiRequestStep,
  context: RunContext,
  apiBase: string
): Promise<{ statusCode: number; observed: Record<string, unknown> }>{
  const endpoint = substitute(step.endpoint, context);
  const url = new URL(String(endpoint), apiBase);

  if (step.queryParams) {
    const queryParams = substitute(step.queryParams, context) as Record<string, unknown>;
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {};
  if (step.headers) {
    const renderedHeaders = substitute(step.headers, context) as Record<string, string>;
    for (const [key, value] of Object.entries(renderedHeaders)) {
      headers[key] = String(value);
    }
  }

  const hasBody = !["GET", "HEAD"].includes(step.method.toUpperCase());
  let body: string | undefined;
  if (hasBody && step.payload !== undefined) {
    const payload = substitute(step.payload, context);
    body = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url.toString(), {
    method: step.method,
    headers,
    body
  });

  const statusCode = response.status;
  const rawText = await response.text();
  let observed: Record<string, unknown> = {};
  try {
    observed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch (error) {
    observed = { raw: rawText };
  }

  context[`step${step.step}_response`] = observed;
  context[`step${step.step}_status`] = statusCode;

  if (step.storeResponseFields) {
    for (const field of step.storeResponseFields) {
      const value = deepGet(observed, field);
      const safeKey = field.replace(/\./g, "_");
      context[`step${step.step}_${safeKey}`] = value;
    }

    if (step.storeAs) {
      if (step.storeResponseFields.length === 1) {
        const field = step.storeResponseFields[0];
        context[step.storeAs] = deepGet(observed, field);
      } else {
        const payload: Record<string, unknown> = {};
        for (const field of step.storeResponseFields) {
          payload[field] = deepGet(observed, field);
        }
        context[step.storeAs] = payload;
      }
    }
  }

  return { statusCode, observed };
}
