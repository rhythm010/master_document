import { z } from "zod";

export const createBookingRatingParamsSchema = z.object({
  id: z.string().uuid()
});

export const bookingRatingStatusParamsSchema = z.object({
  id: z.string().uuid()
});

export const createBookingRatingBodySchema = z.object({
  stars: z.number().optional().nullable(),
  tags: z.array(z.string()).min(1),
  comment: z.string().optional().nullable()
});
