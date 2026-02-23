import { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { getAvailability } from './availability.service';

export async function getAvailabilityHandler(req: Request, res: Response) {
  const { venueId, date } = req.validated?.query as { venueId: string; date: string };
  const data = await getAvailability(venueId, date);

  const slots = data.slots.map((slot) => ({
    ...slot,
    pricing: slot.pricing
      ? {
          ...slot.pricing,
          baseRate: slot.pricing.baseRate.toString(),
          vatAmount: slot.pricing.vatAmount.toString(),
          serviceFee: slot.pricing.serviceFee.toString(),
          grandTotal: slot.pricing.grandTotal.toString(),
        }
      : null,
  }));

  return ok(res, {
    venueId: data.venueId,
    date: data.date,
    slots,
  });
}
