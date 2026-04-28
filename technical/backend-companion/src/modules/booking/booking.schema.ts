import { z } from "zod";

export const createBookingSchema = z.object({
  venueId: z.string().uuid(),
  startAt: z.string().min(1)
});

export const cancelBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const bookingDetailsParamsSchema = z.object({
  id: z.string().uuid()
});
