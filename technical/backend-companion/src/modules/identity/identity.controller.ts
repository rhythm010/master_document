import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  signupSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  updateNicknameSchema
} from "./identity.schema";
import { identityService } from "./identity.service";

export const identityController = {
  signup: asyncHandler(async (req: Request, res: Response) => {
    const input = signupSchema.parse(req.body);
    const result = await identityService.signup(input);
    res.status(201).json(result);
  }),
  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const input = verifyEmailSchema.parse({ token: req.query.token });
    const result = await identityService.verifyEmail(input.token);
    res.status(200).json(result);
  }),
  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    const input = resendVerificationSchema.parse(req.body);
    const result = await identityService.resendVerification(input.email);
    res.status(200).json(result);
  }),
  login: asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await identityService.login(input);
    res.status(200).json(result);
  }),
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const result = await identityService.getMe(req.user!.id);
    res.status(200).json(result);
  }),
  updateNickname: asyncHandler(async (req: Request, res: Response) => {
    const input = updateNicknameSchema.parse(req.body);
    const result = await identityService.updateNickname(req.user!.id, input.nickname);
    res.status(200).json(result);
  })
};
