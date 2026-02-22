import { z } from 'zod';

export const availabilitySchema = z.object({
  query: z.object({
    venueId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});
