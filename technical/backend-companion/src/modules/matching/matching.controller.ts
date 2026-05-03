import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";

import { matchingService } from "./matching.service";
import {
  clientMatchStartSchema,
  clientMatchVerifySchema,
  comMatchVerifySchema,
  matchingBookingParamsSchema,
  matchingLocationSchema
} from "./matching.schema";

export const matchingController = {
  // Return com-com matching context for the requesting companion.
  getComMatchContext: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const result = await matchingService.getComMatchContext({
      bookingId: params.bookingId,
      companionId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Verify companion-companion match using Captain QR/PIN.
  verifyComMatch: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const input = comMatchVerifySchema.parse(req.body);
    const result = await matchingService.verifyComMatch({
      bookingId: params.bookingId,
      companionId: req.user!.id,
      verificationMethod: input.verificationMethod,
      qrCode: input.qrCode,
      pinCode: input.pinCode
    });

    res.status(200).json(result);
  }),

  // Return matching context for the requesting client or companion.
  getMatchingContext: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const result = await matchingService.getMatchingContext({
      bookingId: params.bookingId,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      }
    });

    res.status(200).json(result);
  }),

  // Start client matching by creating the client location row.
  startClientMatch: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const input = clientMatchStartSchema.parse(req.body);
    const result = await matchingService.startClientMatch({
      bookingId: params.bookingId,
      clientId: req.user!.id,
      latitude: input.latitude,
      longitude: input.longitude,
      gpsPermissionGranted: input.gpsPermissionGranted,
      gpsEnabled: input.gpsEnabled
    });

    res.status(200).json(result);
  }),

  // Verify client-companion match using client QR/PIN.
  verifyClientMatch: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const input = clientMatchVerifySchema.parse(req.body);
    const result = await matchingService.verifyClientMatch({
      bookingId: params.bookingId,
      companionId: req.user!.id,
      verificationMethod: input.verificationMethod,
      qrCode: input.qrCode,
      pinCode: input.pinCode
    });

    res.status(200).json(result);
  }),

  // Update the caller's GPS coordinates for matching.
  updateMatchingLocation: asyncHandler(async (req: Request, res: Response) => {
    const params = matchingBookingParamsSchema.parse(req.params);
    const input = matchingLocationSchema.parse(req.body);
    const result = await matchingService.updateMatchingLocation({
      bookingId: params.bookingId,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      },
      latitude: input.latitude,
      longitude: input.longitude,
      gpsPermissionGranted: input.gpsPermissionGranted,
      gpsEnabled: input.gpsEnabled
    });

    res.status(200).json(result);
  })
};
