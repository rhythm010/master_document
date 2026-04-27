import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";
import {
  availabilityQuerySchema,
  listVenuesQuerySchema,
  populateForCompanionSchema,
  releaseSlotsSchema,
  reserveSlotsSchema
} from "./roster.schema";
import { rosterService } from "./roster.service";

export const rosterController = {
  // Search partnered venues by substring.
  listVenues: asyncHandler(async (req: Request, res: Response) => {
    const input = listVenuesQuerySchema.parse({ q: req.query.q });
    const result = await rosterService.listVenues(input.q);
    res.status(200).json(result);
  }),
  // Return available booking start times for a venue on a date.
  getAvailability: asyncHandler(async (req: Request, res: Response) => {
    const input = availabilityQuerySchema.parse({
      venueId: req.query.venueId,
      date: req.query.date
    });
    const result = await rosterService.getAvailability(input);
    res.status(200).json(result);
  }),
  // Reserve a CAPTAIN + VICE_CAPTAIN roster duo for a booking window.
  reserveSlots: asyncHandler(async (req: Request, res: Response) => {
    const input = reserveSlotsSchema.parse(req.body);
    const result = await rosterService.reserveSlots(input);
    res.status(200).json(result);
  }),
  // Release roster slots for a cancelled booking.
  releaseSlots: asyncHandler(async (req: Request, res: Response) => {
    const input = releaseSlotsSchema.parse(req.body);
    const result = await rosterService.releaseSlots(input.bookingId);
    res.status(200).json(result);
  }),
  // Populate roster slots for a companion across assigned venues.
  populateForCompanion: asyncHandler(async (req: Request, res: Response) => {
    const input = populateForCompanionSchema.parse(req.body);
    const result = await rosterService.populateForCompanion(input);
    res.status(200).json(result);
  })
};
