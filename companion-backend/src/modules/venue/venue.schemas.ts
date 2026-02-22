import { z } from 'zod';

export const listVenuesSchema = z.object({
  query: z.object({
    q: z.string().min(2).optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
  }).refine((data) => {
    if ((data.latitude === undefined) !== (data.longitude === undefined)) {
      return false;
    }
    return true;
  }, { message: 'latitude and longitude must be provided together' }),
});
