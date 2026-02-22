import { env } from '../config/env';
import { logger } from '../config/logger';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function holdAmount(amount: string) {
  await sleep(env.MOCK_PAYMENT_DELAY_MS);
  logger.info({ amount }, 'Mock payment hold successful');
  return { success: true } as const;
}

export async function chargeHold(bookingId: string) {
  logger.info({ bookingId }, 'Mock payment charged');
}

export async function voidHold(bookingId: string) {
  logger.info({ bookingId }, 'Mock payment voided');
}

export async function refund(bookingId: string, amount: string) {
  logger.info({ bookingId, amount }, 'Mock payment refunded');
}
