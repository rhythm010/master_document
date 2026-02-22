import { env } from '../config/env';
import { logger } from '../config/logger';

export async function sendOtp(phoneNumber: string, _otp: string) {
  if (!env.MOCK_SMS_ENABLED) {
    logger.warn({ phoneNumber }, 'SMS service disabled, OTP not sent');
    return;
  }
  logger.info({ phoneNumber }, 'Mock SMS OTP sent');
}
