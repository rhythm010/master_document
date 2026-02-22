import { z } from 'zod';

export const adminCreateBookingSchema = z.object({
  body: z.object({
    clientId: z.string().uuid(),
    venueId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    captainId: z.string().uuid().nullable().optional(),
    viceCaptainId: z.string().uuid().nullable().optional(),
  }),
});

export const adminBookingIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

export const adminReassignSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    captainId: z.string().uuid().nullable().optional(),
    viceCaptainId: z.string().uuid().nullable().optional(),
  }),
});
