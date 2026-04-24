import { z } from "zod";

export const signupSchema = z.object({
  role: z.enum(["CLIENT", "COMPANION"]),
  name: z.string().min(1),
  nickname: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  biometricAuthEnabled: z.boolean().optional()
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1)
});

export const resendVerificationSchema = z.object({
  email: z.string().email()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const updateNicknameSchema = z.object({
  nickname: z.string().trim().min(1).max(50)
});
