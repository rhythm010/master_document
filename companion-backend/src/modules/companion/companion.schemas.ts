import { z } from 'zod';

export const companionBookingParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
