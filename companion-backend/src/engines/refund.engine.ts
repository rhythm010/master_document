import { Prisma } from '@prisma/client';
import { REFUND_TIERS } from '../config/constants';

export function calculateRefund(grandTotal: Prisma.Decimal, hoursUntilStart: number) {
  let refundPercentage: number = REFUND_TIERS.NONE.percentage;

  if (hoursUntilStart > REFUND_TIERS.FULL.minHours) {
    refundPercentage = REFUND_TIERS.FULL.percentage;
  } else if (hoursUntilStart >= REFUND_TIERS.PARTIAL.minHours) {
    refundPercentage = REFUND_TIERS.PARTIAL.percentage;
  }

  const refundAmount = grandTotal
    .mul(new Prisma.Decimal(refundPercentage))
    .div(100)
    .toDecimalPlaces(2);

  return { refundPercentage, refundAmount };
}
