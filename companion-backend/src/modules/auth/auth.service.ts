import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { BUSINESS_RULES } from '../../config/constants';
import { generateNumericCode } from '../../shared/utils';
import { AppError } from '../../shared/errors';
import { sendOtp } from '../../services/sms.service';

const otpStore = new Map<string, { hash: string; expiresAt: number }>();
const otpRateLimit = new Map<string, { count: number; windowStart: number }>();

const OTP_WINDOW_MS = 5 * 60 * 1000;
const OTP_REQUEST_LIMIT = 3;

function issueToken(payload: { sub: string; role: string }, expiresIn: SignOptions['expiresIn']) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export async function requestOtp(phoneNumber: string) {
  const now = Date.now();
  const rateEntry = otpRateLimit.get(phoneNumber);

  if (rateEntry && now - rateEntry.windowStart < OTP_WINDOW_MS) {
    if (rateEntry.count >= OTP_REQUEST_LIMIT) {
      throw new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many OTP requests. Try again in 5 minutes.');
    }
    rateEntry.count += 1;
  } else {
    otpRateLimit.set(phoneNumber, { count: 1, windowStart: now });
  }

  const otp = generateNumericCode(BUSINESS_RULES.OTP_LENGTH);
  const hash = await bcrypt.hash(otp, 10);
  otpStore.set(phoneNumber, {
    hash,
    expiresAt: now + env.OTP_EXPIRY_SECONDS * 1000,
  });

  await sendOtp(phoneNumber, otp);

  return { message: 'OTP sent', expiresInSeconds: env.OTP_EXPIRY_SECONDS };
}

export async function verifyOtp(phoneNumber: string, otp: string) {
  const entry = otpStore.get(phoneNumber);
  if (!entry || entry.expiresAt < Date.now()) {
    otpStore.delete(phoneNumber);
    throw new AppError(401, 'INVALID_OTP', 'OTP is invalid or expired.');
  }

  const valid = await bcrypt.compare(otp, entry.hash);
  if (!valid) {
    throw new AppError(401, 'INVALID_OTP', 'OTP is invalid or expired.');
  }

  otpStore.delete(phoneNumber);

  let client = await prisma.client.findUnique({ where: { phoneNumber } });
  let isNewUser = false;

  if (!client) {
    client = await prisma.client.create({
      data: {
        fullName: '',
        nickname: '',
        phoneNumber,
      },
    });
    isNewUser = true;
  }

  const accessToken = issueToken({ sub: client.id, role: 'CLIENT' }, '1h');
  const refreshToken = issueToken({ sub: client.id, role: 'CLIENT' }, '30d');

  return { accessToken, refreshToken, client, isNewUser };
}

export async function adminLogin(email: string, password: string) {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !admin.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const valid = await bcrypt.compare(password, admin.password);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const accessToken = issueToken({ sub: admin.id, role: admin.role }, '8h');
  return { accessToken, admin };
}

export async function refreshToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_SECRET) as { sub: string; role: string };
    if (payload.role !== 'CLIENT') {
      throw new Error('INVALID_ROLE');
    }
    const client = await prisma.client.findUnique({ where: { id: payload.sub } });
    if (!client) {
      throw new Error('MISSING_CLIENT');
    }
    const accessToken = issueToken({ sub: client.id, role: 'CLIENT' }, '1h');
    return { accessToken };
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
  }
}
