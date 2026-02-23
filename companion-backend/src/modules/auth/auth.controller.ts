import { Request, Response } from 'express';
import { ok } from '../../shared/response';
import * as authService from './auth.service';

export async function requestOtp(req: Request, res: Response) {
  const { phoneNumber } = req.validated?.body as { phoneNumber: string };
  const data = await authService.requestOtp(phoneNumber);
  return ok(res, data);
}

export async function verifyOtp(req: Request, res: Response) {
  const { phoneNumber, otp } = req.validated?.body as { phoneNumber: string; otp: string };
  const data = await authService.verifyOtp(phoneNumber, otp);
  return ok(res, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    client: {
      id: data.client.id,
      nickname: data.client.nickname,
      phoneNumber: data.client.phoneNumber,
      bookingStatusCache: data.client.bookingStatusCache,
      currentBookingId: data.client.currentBookingId,
    },
    isNewUser: data.isNewUser,
  });
}

export async function adminLogin(req: Request, res: Response) {
  const { email, password } = req.validated?.body as { email: string; password: string };
  const data = await authService.adminLogin(email, password);
  return ok(res, {
    accessToken: data.accessToken,
    admin: {
      id: data.admin.id,
      name: data.admin.name,
      role: data.admin.role,
    },
  });
}

export async function refreshToken(req: Request, res: Response) {
  const { refreshToken } = req.validated?.body as { refreshToken: string };
  const data = await authService.refreshToken(refreshToken);
  return ok(res, data);
}
