import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  OTP_EXPIRY_SECONDS: z.coerce.number().default(300),
  SOFT_LOCK_MINUTES: z.coerce.number().default(15),
  BOOKING_MIN_LEAD_HOURS: z.coerce.number().default(24),
  BOOKING_MAX_ADVANCE_DAYS: z.coerce.number().default(14),
  SESSION_DURATION_MINUTES: z.coerce.number().default(120),
  REST_BUFFER_MINUTES: z.coerce.number().default(20),
  INTER_BOOKING_BUFFER_MINUTES: z.coerce.number().default(30),
  COMPANION_DETAIL_REVEAL_HOURS: z.coerce.number().default(4),
  DUO_BREACH_MINUTES_BEFORE_START: z.coerce.number().default(20),
  CLIENT_NO_SHOW_MINUTES_AFTER_START: z.coerce.number().default(15),
  SHIFT_CANCEL_PENALTY_HOURS: z.coerce.number().default(4),
  MOCK_PAYMENT_DELAY_MS: z.coerce.number().default(3000),
  MOCK_SMS_ENABLED: z.coerce.boolean().default(true),
});

export const env = envSchema.parse(process.env);
