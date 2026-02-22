import crypto from 'crypto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { BUSINESS_TIMEZONE, BUSINESS_RULES } from '../config/constants';

dayjs.extend(utc);
dayjs.extend(timezone);

export function generateNumericCode(length: number): string {
  const digits = Array.from({ length }, () => Math.floor(Math.random() * 10));
  return digits.join('');
}

export function generateQrCode(): string {
  return crypto.randomUUID();
}

export function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function formatMinutesToTime(minutes: number): string {
  const normalized = minutes % (24 * 60);
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function buildBusinessDateTime(date: string, time: string) {
  return dayjs.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', BUSINESS_TIMEZONE);
}

export function nowBusiness() {
  return dayjs().tz(BUSINESS_TIMEZONE);
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  return formatMinutesToTime(parseTimeToMinutes(startTime) + durationMinutes);
}

export function isSlotWithinOperatingHours(
  slotStart: string,
  slotEnd: string,
  operatingStart: string,
  operatingEnd: string,
): boolean {
  const startMinutes = parseTimeToMinutes(operatingStart);
  let endMinutes = parseTimeToMinutes(operatingEnd);
  if (endMinutes <= startMinutes) {
    endMinutes = 24 * 60;
  }
  const slotStartMinutes = parseTimeToMinutes(slotStart);
  const slotEndMinutes = parseTimeToMinutes(slotEnd);
  return slotStartMinutes >= startMinutes && slotEndMinutes <= endMinutes;
}

export function generateSlots(
  operatingStart: string,
  operatingEnd: string,
  durationMinutes: number,
): Array<{ startTime: string; endTime: string }>
{
  const slots: Array<{ startTime: string; endTime: string }> = [];
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

export function hoursUntil(date: string, time: string): number {
  const target = buildBusinessDateTime(date, time);
  return target.diff(nowBusiness(), 'hour', true);
}

export function addMinutesToTime(time: string, minutes: number): string {
  return formatMinutesToTime(parseTimeToMinutes(time) + minutes);
}

export function subtractMinutesFromTime(time: string, minutes: number): string {
  return formatMinutesToTime(parseTimeToMinutes(time) - minutes + 24 * 60);
}

export function parseBusinessDate(date: string) {
  return dayjs.tz(date, 'YYYY-MM-DD', BUSINESS_TIMEZONE);
}

export function isDateWithinBookingWindow(date: string): boolean {
  const target = parseBusinessDate(date).startOf('day');
  const minDate = nowBusiness()
    .add(BUSINESS_RULES.BOOKING_MIN_LEAD_HOURS, 'hour')
    .startOf('day');
  const maxDate = nowBusiness()
    .add(BUSINESS_RULES.BOOKING_MAX_ADVANCE_DAYS, 'day')
    .endOf('day');
  return (target.isSame(minDate) || target.isAfter(minDate)) && (target.isSame(maxDate) || target.isBefore(maxDate));
}

export function haversineDistanceKm(
  latitude: number,
  longitude: number,
  venueLat: number,
  venueLon: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(venueLat - latitude);
  const dLon = toRad(venueLon - longitude);
  const lat1 = toRad(latitude);
  const lat2 = toRad(venueLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getExpandedSlotWindow(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime) - BUSINESS_RULES.INTER_BOOKING_BUFFER_MINUTES;
  const end = parseTimeToMinutes(endTime) + BUSINESS_RULES.REST_BUFFER_MINUTES;
  return {
    startMinutes: start,
    endMinutes: end,
  };
}

export async function withSerializableRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100,
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === '40001' && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error('SERIALIZATION_RETRY_EXCEEDED');
}
