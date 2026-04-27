import { z } from "zod";

export const listVenuesQuerySchema = z.object({
  q: z.string().trim().min(1)
});

export const availabilityQuerySchema = z.object({
  venueId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
});

export const reserveSlotsSchema = z.object({
  venueId: z.string().uuid(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  bookingId: z.string().uuid()
});

export const releaseSlotsSchema = z.object({
  bookingId: z.string().uuid()
});

export const populateForCompanionSchema = z.object({
  companionId: z.string().uuid(),
  venueIds: z.array(z.string().uuid()).min(1)
});
