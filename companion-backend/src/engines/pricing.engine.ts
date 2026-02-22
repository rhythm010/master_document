import { Prisma } from '@prisma/client';
import { PRICING, CURRENCY } from '../config/constants';

export function calculatePrice(venueType: keyof typeof PRICING) {
  const pricing = PRICING[venueType];
  const baseRate = new Prisma.Decimal(pricing.baseRate.toFixed(2));
  const vatAmount = baseRate.mul(pricing.vatRate).toDecimalPlaces(2);
  const serviceFee = new Prisma.Decimal(pricing.serviceFee.toFixed(2));
  const grandTotal = baseRate.add(vatAmount).add(serviceFee).toDecimalPlaces(2);

  return {
    baseRate,
    vatAmount,
    serviceFee,
    grandTotal,
    currency: CURRENCY,
  };
}
