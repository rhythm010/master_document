import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";

import { bookingService } from "./booking.service";
import {
  bookingDetailsParamsSchema,
  bookingMessagesParamsSchema,
  bookingSessionParamsSchema,
  cancelBookingParamsSchema,
  createBookingMessageSchema,
  createBookingSchema,
  extendBookingParamsSchema,
  internalEditBookingBodySchema,
  internalEditBookingParamsSchema,
  sosBookingParamsSchema
} from "./booking.schema";

export const bookingController = {
  // Create a new booking and allocate a companion duo.
  createBooking: asyncHandler(async (req: Request, res: Response) => {
    const input = createBookingSchema.parse(req.body);
    const result = await bookingService.createBooking({
      clientId: req.user!.id,
      venueId: input.venueId,
      startAt: input.startAt
    });

    res.status(201).json(result);
  }),

  // Cancel a booking owned by the client or assigned companion.
  cancelBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = cancelBookingParamsSchema.parse(req.params);
    const result = await bookingService.cancelBooking({
      bookingId: params.id,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      }
    });

    res.status(200).json(result);
  }),

  // Extend an active booking session by +1 hour.
  extendBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = extendBookingParamsSchema.parse(req.params);
    const result = await bookingService.extendBooking({
      bookingId: params.id,
      clientId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Trigger SOS stub for an active booking.
  sosBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = sosBookingParamsSchema.parse(req.params);
    const result = await bookingService.sosBooking({
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
    const result = await bookingService.getBookingSession({
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
    const result = await bookingService.listBookingMessages({
      bookingId: params.id,
      companionId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Send a captain↔vice session message for the booking.
  createBookingMessage: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingMessagesParamsSchema.parse(req.params);
    const input = createBookingMessageSchema.parse(req.body);

    const result = await bookingService.createBookingMessage({
      bookingId: params.id,
      companionId: req.user!.id,
      content: input.content
    });

    res.status(201).json(result);
  }),

  // Return minimal booking details for the owning client.
  getBookingDetails: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingDetailsParamsSchema.parse(req.params);
    const result = await bookingService.getBookingDetails({
      bookingId: params.id,
      clientId: req.user!.id
    });

    res.status(200).json(result);
  }),

  // Internal-only edit of a CONFIRMED booking (time/venue and optional duo reassignment).
  internalEditBooking: asyncHandler(async (req: Request, res: Response) => {
    const params = internalEditBookingParamsSchema.parse(req.params);
    const input = internalEditBookingBodySchema.parse(req.body);

    const result = await bookingService.internalEditBooking({
      bookingId: params.id,
      venueId: input.venueId,
      startAt: input.startAt,
      captainCompanionId: input.captainCompanionId,
      viceCaptainCompanionId: input.viceCaptainCompanionId
    });

    res.status(200).json(result);
  })
};
