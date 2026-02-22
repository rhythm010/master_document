import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../shared/async-handler';
import * as authController from './auth.controller';
import {
  requestOtpSchema,
  verifyOtpSchema,
  adminLoginSchema,
  refreshTokenSchema,
} from './auth.schemas';

const router = Router();

router.post('/otp/request', validate(requestOtpSchema), asyncHandler(authController.requestOtp));
router.post('/otp/verify', validate(verifyOtpSchema), asyncHandler(authController.verifyOtp));
router.post('/admin/login', validate(adminLoginSchema), asyncHandler(authController.adminLogin));
router.post('/token/refresh', validate(refreshTokenSchema), asyncHandler(authController.refreshToken));

export default router;
