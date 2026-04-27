import dotenv from "dotenv";
import { z } from "zod";
import process from "node:process";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
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
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  WEB_VERIFY_URL: z.string().default("https://companion.app/verify-email?token={token}")
});

const env = envSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: Number(env.PORT),
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
  publicBaseUrl: env.PUBLIC_BASE_URL,
  webVerifyUrl: env.WEB_VERIFY_URL
};
