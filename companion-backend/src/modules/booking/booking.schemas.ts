import { z } from 'zod';

export const createBookingSchema = z.object({
  body: z.object({
    venueId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
  }),
});

export const bookingIdParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().max(500).optional(),
  }),
});
