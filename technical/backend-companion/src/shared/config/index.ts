import dotenv from "dotenv";
import { z } from "zod";
import process from "node:process";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Non-secret environment discriminator used for application behavior.
   *
   * Note: This is intentionally separate from NODE_ENV.
   */
  APP_ENV: z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    },
    z.enum(["local", "dev", "staging", "production"]).optional()
  ),
  PORT: z.string().default("3000"),
  ENABLE_SCHEDULERS: z.string().optional().default("false"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  INTERNAL_API_TOKEN: z.string().min(1),
  BCRYPT_ROUNDS: z.string().default("12"),
  EMAIL_VERIFY_TOKEN_TTL: z.string().default("86400"),
  AUTH_ACCESS_TOKEN_TTL: z.string().default("3600"),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: z.string().default("5"),
  LOGIN_RATE_LIMIT_WINDOW: z.string().default("15"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.string().default("1025"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("noreply@companion.app"),
  /**
   * Controls whether emails are actually sent.
   * - smtp: send via SMTP
   * - log_only: log the rendered email and skip sending
   * - disabled: skip sending entirely
   */
  EMAIL_DELIVERY_MODE: z.enum(["smtp", "disabled", "log_only"]).optional(),
  /**
   * Optional override for the mobile deep-link scheme prefix.
   * Example: "companion-dev://".
   */
  MOBILE_DEEPLINK_SCHEME: z.string().optional(),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  WEB_VERIFY_URL: z
    .string()
    .default("https://companion.app/verify-email?token={token}")
    .refine((value) => value.includes("{token}"), {
      message: "WEB_VERIFY_URL must contain the '{token}' placeholder"
    }),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:8081,http://localhost:19006,http://localhost:3000")
});

const env = envSchema.parse(process.env);

type AppEnv = "local" | "dev" | "staging" | "production";

type EmailDeliveryMode = "smtp" | "disabled" | "log_only";

// Select the default mobile deep-link scheme per environment.
function defaultMobileDeepLinkScheme(appEnv: AppEnv): string {
  switch (appEnv) {
    case "production":
      return "companion://";
    case "staging":
      return "companion-staging://";
    case "local":
    case "dev":
    default:
      return "companion-dev://";
  }
}

// Normalize a deep-link scheme prefix to canonical "<scheme>://" and validate the scheme.
function normalizeDeepLinkScheme(rawScheme: string): string {
  const trimmed = rawScheme.trim();
  if (!trimmed) {
    throw new Error("MOBILE_DEEPLINK_SCHEME cannot be empty when provided");
  }

  // Reject values that look like a full deep link rather than a scheme prefix.
  if (trimmed.includes("://") && !trimmed.endsWith("://")) {
    throw new Error(
      "MOBILE_DEEPLINK_SCHEME must be a scheme prefix (e.g. 'companion-dev://'), not a full URL"
    );
  }

  const schemeName = trimmed.replace(/:\/{0,2}$/, "");
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(schemeName)) {
    throw new Error(
      "MOBILE_DEEPLINK_SCHEME must start with a valid URI scheme name (letters, digits, '+', '.', '-')"
    );
  }

  return `${schemeName.toLowerCase()}://`;
}

// Compute delivery mode with staging-safe default.
function resolveEmailDeliveryMode(appEnv: AppEnv, explicit?: EmailDeliveryMode): EmailDeliveryMode {
  if (explicit) return explicit;
  return appEnv === "staging" ? "log_only" : "smtp";
}

// Enforce explicit and safe environment configuration in production deployments.
function resolveAppEnv(nodeEnv: string, rawAppEnv: AppEnv | undefined): AppEnv {
  if (nodeEnv === "production") {
    if (!rawAppEnv) {
      throw new Error(
        "APP_ENV must be explicitly set to 'staging' or 'production' when NODE_ENV=production"
      );
    }

    if (rawAppEnv !== "staging" && rawAppEnv !== "production") {
      throw new Error(
        "When NODE_ENV=production, APP_ENV must be either 'staging' or 'production' (not 'local'/'dev')"
      );
    }

    return rawAppEnv;
  }

  return rawAppEnv ?? "local";
}

const appEnv = resolveAppEnv(env.NODE_ENV, env.APP_ENV as AppEnv | undefined);
const emailDeliveryMode = resolveEmailDeliveryMode(appEnv, env.EMAIL_DELIVERY_MODE);
const mobileDeepLinkScheme = normalizeDeepLinkScheme(
  env.MOBILE_DEEPLINK_SCHEME ?? defaultMobileDeepLinkScheme(appEnv)
);

/** Shared runtime configuration derived from environment variables. */
export const config = {
  nodeEnv: env.NODE_ENV,
  appEnv,
  port: Number(env.PORT),
  enableSchedulers: env.ENABLE_SCHEDULERS === "true",
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  internalApiToken: env.INTERNAL_API_TOKEN,
  bcryptRounds: Number(env.BCRYPT_ROUNDS),
  emailVerifyTokenTtlSeconds: Number(env.EMAIL_VERIFY_TOKEN_TTL),
  authAccessTokenTtlSeconds: Number(env.AUTH_ACCESS_TOKEN_TTL),
  loginRateLimitMaxAttempts: Number(env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS),
  loginRateLimitWindowMinutes: Number(env.LOGIN_RATE_LIMIT_WINDOW),
  smtpHost: env.SMTP_HOST,
  smtpPort: Number(env.SMTP_PORT),
  smtpUser: env.SMTP_USER ?? "",
  smtpPass: env.SMTP_PASS ?? "",
  emailFrom: env.EMAIL_FROM,
  emailDeliveryMode,
  mobileDeepLinkScheme,
  publicBaseUrl: env.PUBLIC_BASE_URL,
  webVerifyUrl: env.WEB_VERIFY_URL,
  corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
};
