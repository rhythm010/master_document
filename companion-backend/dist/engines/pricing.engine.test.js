"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pricing_engine_1 = require("./pricing.engine");
(0, vitest_1.describe)('pricing.engine', () => {
    (0, vitest_1.it)('calculates mall pricing', () => {
        const pricing = (0, pricing_engine_1.calculatePrice)('MALL');
        (0, vitest_1.expect)(pricing.baseRate.toString()).toBe('500');
        (0, vitest_1.expect)(pricing.vatAmount.toString()).toBe('25');
        (0, vitest_1.expect)(pricing.serviceFee.toString()).toBe('50');
        (0, vitest_1.expect)(pricing.grandTotal.toString()).toBe('575');
    });
});
