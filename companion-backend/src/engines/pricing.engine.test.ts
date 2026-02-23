import { describe, expect, it } from 'vitest';
import { calculatePrice } from './pricing.engine';

describe('pricing.engine', () => {
  it('calculates mall pricing', () => {
    const pricing = calculatePrice('MALL');
    expect(pricing.baseRate.toString()).toBe('500');
    expect(pricing.vatAmount.toString()).toBe('25');
    expect(pricing.serviceFee.toString()).toBe('50');
    expect(pricing.grandTotal.toString()).toBe('575');
  });
});
