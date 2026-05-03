import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";

import {
  bookingMessagesParamsSchema,
  bookingSessionParamsSchema,
  createBookingMessageSchema,
  extendBookingParamsSchema,
  sosBookingParamsSchema
} from "./session-in-progress.schema";
import { sessionInProgressService } from "./session-in-progress.service";

export const sessionInProgressController = {
  // Extend an active booking session by +1 hour.
  extendBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = extendBookingParamsSchema.parse(req.params);
    const result = await sessionInProgressService.extendBooking({
      bookingId: params.id,
      clientId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Trigger SOS stub for an active booking.
  sosBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = sosBookingParamsSchema.parse(req.params);
    const result = await sessionInProgressService.sosBooking({
      bookingId: params.id,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      }
    });

    res.status(200).json(result);
  }),

  // Return session metadata for the booking.
  getBookingSession: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingSessionParamsSchema.parse(req.params);
    const result = await sessionInProgressService.getBookingSession({
      bookingId: params.id,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      }
    });

    res.status(200).json(result);
  }),

  // List captain↔vice session messages for the booking.
  listBookingMessages: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingMessagesParamsSchema.parse(req.params);
    const result = await sessionInProgressService.listBookingMessages({
      bookingId: params.id,
      companionId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Send a captain↔vice session message for the booking.
  createBookingMessage: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingMessagesParamsSchema.parse(req.params);
    const input = createBookingMessageSchema.parse(req.body);

    const result = await sessionInProgressService.createBookingMessage({
      bookingId: params.id,
      companionId: req.user!.id,
      content: input.content
    });

    res.status(201).json(result);
  })
};
