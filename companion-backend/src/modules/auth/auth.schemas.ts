import { z } from 'zod';

const phoneRegex = /^\+[1-9]\d{1,14}$/;

export const requestOtpSchema = z.object({
  body: z.object({
    phoneNumber: z.string().regex(phoneRegex),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phoneNumber: z.string().regex(phoneRegex),
    otp: z.string().regex(/^\d{6}$/),
  }),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }),
});
