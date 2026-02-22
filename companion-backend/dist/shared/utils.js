"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNumericCode = generateNumericCode;
exports.generateQrCode = generateQrCode;
exports.parseTimeToMinutes = parseTimeToMinutes;
exports.formatMinutesToTime = formatMinutesToTime;
exports.buildBusinessDateTime = buildBusinessDateTime;
exports.nowBusiness = nowBusiness;
exports.calculateEndTime = calculateEndTime;
exports.isSlotWithinOperatingHours = isSlotWithinOperatingHours;
exports.generateSlots = generateSlots;
exports.hoursUntil = hoursUntil;
exports.addMinutesToTime = addMinutesToTime;
exports.subtractMinutesFromTime = subtractMinutesFromTime;
exports.parseBusinessDate = parseBusinessDate;
exports.isDateWithinBookingWindow = isDateWithinBookingWindow;
exports.haversineDistanceKm = haversineDistanceKm;
exports.getExpandedSlotWindow = getExpandedSlotWindow;
exports.withSerializableRetry = withSerializableRetry;
const crypto_1 = __importDefault(require("crypto"));
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const constants_1 = require("../config/constants");
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
function generateNumericCode(length) {
    const digits = Array.from({ length }, () => Math.floor(Math.random() * 10));
    return digits.join('');
}
function generateQrCode() {
    return crypto_1.default.randomUUID();
}
function parseTimeToMinutes(time) {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
}
function formatMinutesToTime(minutes) {
    const normalized = minutes % (24 * 60);
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function buildBusinessDateTime(date, time) {
    return dayjs_1.default.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', constants_1.BUSINESS_TIMEZONE);
}
function nowBusiness() {
    return (0, dayjs_1.default)().tz(constants_1.BUSINESS_TIMEZONE);
}
function calculateEndTime(startTime, durationMinutes) {
    return formatMinutesToTime(parseTimeToMinutes(startTime) + durationMinutes);
}
function isSlotWithinOperatingHours(slotStart, slotEnd, operatingStart, operatingEnd) {
    const startMinutes = parseTimeToMinutes(operatingStart);
    let endMinutes = parseTimeToMinutes(operatingEnd);
    if (endMinutes <= startMinutes) {
        endMinutes = 24 * 60;
    }
    const slotStartMinutes = parseTimeToMinutes(slotStart);
    const slotEndMinutes = parseTimeToMinutes(slotEnd);
    return slotStartMinutes >= startMinutes && slotEndMinutes <= endMinutes;
}
function generateSlots(operatingStart, operatingEnd, durationMinutes) {
    const slots = [];
    const startMinutes = parseTimeToMinutes(operatingStart);
    let endMinutes = parseTimeToMinutes(operatingEnd);
    if (endMinutes <= startMinutes) {
        endMinutes = 24 * 60;
    }
    for (let current = startMinutes; current + durationMinutes <= endMinutes; current += durationMinutes) {
        const startTime = formatMinutesToTime(current);
        const endTime = formatMinutesToTime(current + durationMinutes);
        slots.push({ startTime, endTime });
    }
    return slots;
}
function hoursUntil(date, time) {
    const target = buildBusinessDateTime(date, time);
    return target.diff(nowBusiness(), 'hour', true);
}
function addMinutesToTime(time, minutes) {
    return formatMinutesToTime(parseTimeToMinutes(time) + minutes);
}
function subtractMinutesFromTime(time, minutes) {
    return formatMinutesToTime(parseTimeToMinutes(time) - minutes + 24 * 60);
}
function parseBusinessDate(date) {
    return dayjs_1.default.tz(date, 'YYYY-MM-DD', constants_1.BUSINESS_TIMEZONE);
}
function isDateWithinBookingWindow(date) {
    const target = parseBusinessDate(date).startOf('day');
    const minDate = nowBusiness()
        .add(constants_1.BUSINESS_RULES.BOOKING_MIN_LEAD_HOURS, 'hour')
        .startOf('day');
    const maxDate = nowBusiness()
        .add(constants_1.BUSINESS_RULES.BOOKING_MAX_ADVANCE_DAYS, 'day')
        .endOf('day');
    return (target.isSame(minDate) || target.isAfter(minDate)) && (target.isSame(maxDate) || target.isBefore(maxDate));
}
function haversineDistanceKm(latitude, longitude, venueLat, venueLon) {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(venueLat - latitude);
    const dLon = toRad(venueLon - longitude);
    const lat1 = toRad(latitude);
    const lat2 = toRad(venueLat);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function getExpandedSlotWindow(startTime, endTime) {
    const start = parseTimeToMinutes(startTime) - constants_1.BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
    const end = parseTimeToMinutes(endTime) + constants_1.BUSINESS_RULES.REST_BUFFER_MINUTES;
    return {
        startMinutes: start,
        endMinutes: end,
    };
}
async function withSerializableRetry(fn, maxRetries = 3, baseDelayMs = 100) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            return await fn();
        }
        catch (error) {
            if (error?.code === '40001' && attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
                continue;
            }
            throw error;
        }
    }
    throw new Error('SERIALIZATION_RETRY_EXCEEDED');
}
