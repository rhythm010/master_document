import { config } from "./config";
import type { ExternalCheckStep, RunContext, WaitPolicy } from "./types";
import { decodeQuotedPrintable, renderTemplate, sleep } from "./utils";

const TOKEN_REGEX = /token=([A-Za-z0-9._-]+)/;

/** Poll Mailpit for a message and optionally extract a verification token. */
export async function executeExternalCheck(
  step: ExternalCheckStep,
  context: RunContext,
  mailpitBase: string,
  waitPolicy?: WaitPolicy
): Promise<{ observed: Record<string, unknown> }>{
  const validateEmailTo = renderTemplate(step.validateEmailTo, context);
  const rawEndpoint = step.endpoint
    ? renderTemplate(step.endpoint, context)
    : `${mailpitBase}/api/v1/messages`;
  const endpoint = rawEndpoint.startsWith("http") ? rawEndpoint : `${mailpitBase}${rawEndpoint}`;
  const retryCount = waitPolicy?.retryCount ?? 10;
  const maxSeconds = waitPolicy?.maxSeconds ?? config.mailpit.maxWaitSeconds;
  const maxTime = Date.now() + maxSeconds * 1000;

  // Exponential backoff polling
  let pollInterval = config.mailpit.pollIntervalMs;
  const maxInterval = config.mailpit.maxPollIntervalMs;
  const backoff = config.mailpit.backoffMultiplier;

  let message: Record<string, unknown> | null = null;
  
  // Graceful skip if Mailpit unavailable
  try {
    for (let attempt = 0; attempt < retryCount; attempt += 1) {
      if (Date.now() > maxTime) {
        break;
      }

      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Mailpit returned ${response.status}`);
      }
      
      const body = (await response.json()) as { messages?: Array<Record<string, unknown>> };
      const messages = Array.isArray(body.messages) ? body.messages : [];

      message = messages.find((entry) => {
        const recipients = Array.isArray(entry.To) ? entry.To : [];
        return recipients.some((recipient) => recipient.Address === validateEmailTo);
      }) || null;

      // Early exit on first match
      if (message) {
        break;
      }

      await sleep(pollInterval);
      // Exponential backoff
      pollInterval = Math.min(pollInterval * backoff, maxInterval);
    }
  } catch (error) {
    console.warn("⚠️  Mailpit unavailable, skipping email verification:", String(error));
    return {
      observed: {
        emailFound: false,
        skipped: true,
        reason: "Mailpit unavailable"
      }
    };
  }

  const observed: Record<string, unknown> = {
    emailFound: Boolean(message)
  };

  if (message && step.extractTokenFromEmail) {
    const messageId = String(message.ID || "");
    if (messageId) {
      try {
        const rawResponse = await fetch(`${mailpitBase}/api/v1/message/${messageId}/raw`);
        const rawText = await rawResponse.text();
        const decoded = decodeQuotedPrintable(rawText);
        const match = decoded.match(TOKEN_REGEX);
        const token = match ? match[1] : null;
        observed.tokenExtracted = Boolean(token);
        if (token) {
          const storeKey = step.storeAs || "verificationToken";
          context[storeKey] = token;
          context[`step${step.step}_verificationToken`] = token;
        }
      } catch (error) {
        console.warn("⚠️  Failed to extract token from email:", String(error));
        observed.tokenExtracted = false;
      }
    }
  }

  return { observed };
}
