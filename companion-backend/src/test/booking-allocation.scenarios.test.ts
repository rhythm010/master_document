import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import dayjs from 'dayjs';
import jwt from 'jsonwebtoken';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminRole,
  AllocationMode,
  BookingStatus,
  CompanionRole,
  DuoStatus,
  PaymentHoldStatus,
} from '@prisma/client';
import authRoutes from '../modules/auth/auth.routes';
import venueRoutes from '../modules/venue/venue.routes';
import availabilityRoutes from '../modules/availability/availability.routes';
import bookingRoutes from '../modules/booking/booking.routes';
import adminRoutes from '../modules/admin/admin.routes';
import companionRoutes from '../modules/companion/companion.routes';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { errorHandler } from '../middleware/error-handler';
import { prisma } from '../config/prisma';
import { BUSINESS_RULES } from '../config/constants';
import { calculatePrice } from '../engines/pricing.engine';
import {
  calculateEndTime,
  generateNumericCode,
  generateQrCode,
  nowBusiness,
  parseBusinessDate,
} from '../shared/utils';
import { runSoftLockExpiry } from '../schedulers/soft-lock-expiry.job';
import { runDuoBreach } from '../schedulers/duo-breach.job';
import { runClientNoShow } from '../schedulers/client-no-show.job';
import { createTestCompanion, getAuthToken, getAdminToken } from './helpers';
import { sendOtp } from '../services/sms.service';
import * as paymentService from '../services/payment.service';

vi.mock('../services/sms.service', () => ({ sendOtp: vi.fn() }));

const app = buildTestApp();
const sendOtpMock = vi.mocked(sendOtp);

function buildTestApp() {
  const appInstance = express();
  appInstance.use(express.json());
  appInstance.use('/api/v1/auth', authRoutes);
  appInstance.use('/api/v1/venues', authenticate, authorize('CLIENT'), venueRoutes);
  appInstance.use('/api/v1/availability', authenticate, authorize('CLIENT'), availabilityRoutes);
  appInstance.use('/api/v1/bookings', authenticate, authorize('CLIENT'), bookingRoutes);
  appInstance.use('/api/v1/admin', authenticate, adminRoutes);
  appInstance.use('/api/v1/companion', authenticate, companionRoutes);
  appInstance.use(errorHandler);
  return appInstance;
}

async function seedDatabase() {
  await prisma.bookingAuditLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.penalty.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.companion.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.client.deleteMany();
  await prisma.admin.deleteMany();

  await prisma.venue.createMany({
    data: [
      {
        name: 'Dubai Mall',
        type: 'MALL',
        address: 'Financial Centre Rd, Downtown Dubai',
        latitude: 25.1972,
        longitude: 55.2796,
        country: 'AE',
        operatingHoursStart: '10:00',
        operatingHoursEnd: '00:00',
      },
      {
        name: 'Mall of the Emirates',
        type: 'MALL',
        address: 'Sheikh Zayed Rd, Al Barsha',
        latitude: 25.118,
        longitude: 55.2,
        country: 'AE',
        operatingHoursStart: '10:00',
        operatingHoursEnd: '00:00',
      },
      {
        name: 'Nobu Dubai',
        type: 'RESTAURANT',
        address: 'Atlantis The Palm',
        latitude: 25.1304,
        longitude: 55.117,
        country: 'AE',
        operatingHoursStart: '12:00',
        operatingHoursEnd: '23:00',
      },
      {
        name: 'Zuma Dubai',
        type: 'RESTAURANT',
        address: 'DIFC, Dubai',
        latitude: 25.2128,
        longitude: 55.2795,
        country: 'AE',
        operatingHoursStart: '12:00',
        operatingHoursEnd: '23:00',
      },
      {
        name: 'White Dubai',
        type: 'CLUB',
        address: 'Meydan Racecourse',
        latitude: 25.1675,
        longitude: 55.299,
        country: 'AE',
        operatingHoursStart: '20:00',
        operatingHoursEnd: '00:00',
      },
    ],
  });

  const companions = [];
  for (let i = 0; i < 5; i += 1) {
    companions.push({
      fullName: `Captain ${i + 1}`,
      phoneNumber: `+97150000${100 + i}`,
      role: CompanionRole.CAPTAIN,
      isActive: true,
      backgroundVerified: true,
      languageSkills: { en: true, ar: true },
    });
  }
  for (let i = 0; i < 5; i += 1) {
    companions.push({
      fullName: `Vice Captain ${i + 1}`,
      phoneNumber: `+97150000${200 + i}`,
      role: CompanionRole.VICE_CAPTAIN,
      isActive: true,
      backgroundVerified: true,
      languageSkills: { en: true, ar: true },
    });
  }

  const createdCompanions = await prisma.$transaction(
    companions.map((companion) => prisma.companion.create({ data: companion })),
  );

  const shifts: Array<{
    companionId: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: 'SCHEDULED';
  }> = [];

  createdCompanions.forEach((companion, index) => {
    const dayOffset = (index % 7) + 1;
    const secondOffset = dayOffset + 7;
    const shiftDates = [dayOffset, secondOffset];
    shiftDates.forEach((offset, idx) => {
      const date = dayjs().add(offset, 'day').startOf('day').toDate();
      const startTime = idx % 2 === 0 ? '09:00' : '15:00';
      const endTime = idx % 2 === 0 ? '15:00' : '21:00';
      shifts.push({
        companionId: companion.id,
        date,
        startTime,
        endTime,
        status: 'SCHEDULED',
      });
    });
  });

  await prisma.shift.createMany({ data: shifts });

  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: {
      name: 'Super Admin',
      email: 'admin@companion.ae',
      password: adminPassword,
      role: AdminRole.SUPER_ADMIN,
      permissions: ['ALL'],
    },
  });

  await prisma.client.createMany({
    data: [
      {
        fullName: 'Test Client 1',
        nickname: 'Client1',
        phoneNumber: '+971501111111',
      },
      {
        fullName: 'Test Client 2',
        nickname: 'Client2',
        phoneNumber: '+971502222222',
      },
      {
        fullName: 'Test Client 3',
        nickname: 'Client3',
        phoneNumber: '+971503333333',
      },
    ],
  });
}

async function getSeededVenue() {
  return prisma.venue.findFirstOrThrow({ where: { name: 'Dubai Mall' } });
}

async function getSeededClient(index = 0) {
  const clients = await prisma.client.findMany({ orderBy: { phoneNumber: 'asc' } });
  return clients[index];
}

async function getSeededAdmin() {
  return prisma.admin.findFirstOrThrow();
}

async function getAnyDuo() {
  const captain = await prisma.companion.findFirstOrThrow({
    where: { role: CompanionRole.CAPTAIN },
  });
  const vice = await prisma.companion.findFirstOrThrow({
    where: { role: CompanionRole.VICE_CAPTAIN },
  });
  return { captainId: captain.id, viceCaptainId: vice.id };
}

async function getDuoForDate(date: string) {
  const shiftDate = parseBusinessDate(date).startOf('day').toDate();
  const shifts = await prisma.shift.findMany({
    where: { date: shiftDate },
    include: { companion: true },
  });
  const captain = shifts.find((shift) => shift.companion.role === CompanionRole.CAPTAIN);
  const vice = shifts.find((shift) => shift.companion.role === CompanionRole.VICE_CAPTAIN);
  if (!captain || !vice) {
    throw new Error('DUO_MISSING');
  }
  return { captainId: captain.companionId, viceCaptainId: vice.companionId };
}

async function createBookingRecord(params: {
  clientId: string;
  venueId: string;
  captainId: string;
  viceCaptainId: string;
  date: string;
  startTime: string;
  status?: BookingStatus;
  duoStatus?: DuoStatus;
  softLockExpiresAt?: Date | null;
  paymentHoldStatus?: PaymentHoldStatus;
  sessionStartedAt?: Date | null;
}) {
  const {
    clientId,
    venueId,
    captainId,
    viceCaptainId,
    date,
    startTime,
    status = BookingStatus.CONFIRMED,
    duoStatus = DuoStatus.PENDING,
    softLockExpiresAt,
    paymentHoldStatus = status === BookingStatus.PENDING
      ? PaymentHoldStatus.NONE
      : PaymentHoldStatus.HELD,
    sessionStartedAt = null,
  } = params;
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
  const venue = await prisma.venue.findUniqueOrThrow({ where: { id: venueId } });
  const endTime = calculateEndTime(startTime, BUSINESS_RULES.SESSION_DURATION_MINUTES);
  const pricing = calculatePrice(venue.type);
  const bookingDate = parseBusinessDate(date).startOf('day').toDate();

  const booking = await prisma.booking.create({
    data: {
      clientId,
      venueId,
      captainId,
      viceCaptainId,
      allocationMode: AllocationMode.AUTO,
      clientNicknameSnapshot: client.nickname,
      duoStatus,
      duoQrCode: generateQrCode(),
      duoPinCode: generateNumericCode(BUSINESS_RULES.DUO_PIN_LENGTH),
      qrCode: generateQrCode(),
      pinCode: generateNumericCode(BUSINESS_RULES.CLIENT_PIN_LENGTH),
      date: bookingDate,
      startTime,
      endTime,
      durationMinutes: BUSINESS_RULES.SESSION_DURATION_MINUTES,
      status,
      baseRate: pricing.baseRate,
      vatAmount: pricing.vatAmount,
      serviceFee: pricing.serviceFee,
      grandTotal: pricing.grandTotal,
      paymentHoldStatus,
      paymentHoldAmount: paymentHoldStatus === PaymentHoldStatus.HELD ? pricing.grandTotal : null,
      softLockExpiresAt: softLockExpiresAt ?? null,
      sessionStartedAt,
    },
  });

  const bookingStatusCache =
    status === BookingStatus.PENDING
      ? 'PENDING'
      : status === BookingStatus.CONFIRMED
      ? 'CONFIRMED'
      : 'NONE';

  await prisma.client.update({
    where: { id: clientId },
    data: { currentBookingId: booking.id, bookingStatusCache },
  });

  return booking;
}

describe('Booking & allocation flow scenarios', () => {
  beforeEach(async () => {
    vi.useRealTimers();
    sendOtpMock.mockClear();
    await seedDatabase();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('handles OTP login, admin login, token refresh, and expired token checks', async () => {
    const phoneNumber = '+971500001111';
    const otpRequest = await request(app).post('/api/v1/auth/otp/request').send({ phoneNumber });
    expect(otpRequest.status).toBe(200);
    expect(sendOtpMock).toHaveBeenCalledTimes(1);

    const otp = sendOtpMock.mock.calls[0]?.[1];
    expect(otp).toHaveLength(6);

    const otpVerify = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ phoneNumber, otp });
    expect(otpVerify.status).toBe(200);
    expect(otpVerify.body.data.accessToken).toBeTruthy();

    const refresh = await request(app)
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: otpVerify.body.data.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();

    const admin = await getSeededAdmin();
    const adminLogin = await request(app)
      .post('/api/v1/auth/admin/login')
      .send({ email: admin.email, password: 'admin123' });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body.data.accessToken).toBeTruthy();

    const expiredToken = jwt.sign(
      { sub: otpVerify.body.data.client.id, role: 'CLIENT' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '-1s' },
    );
    const expiredResponse = await request(app)
      .get('/api/v1/venues')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.error.code).toBe('INVALID_TOKEN');
  });

  it('supports venue autocomplete, distance sorting, and excludes inactive venues', async () => {
    const client = await getSeededClient();
    const token = getAuthToken(client.id);

    const search = await request(app)
      .get('/api/v1/venues')
      .query({ q: 'Dub' })
      .set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    const names = search.body.data.venues.map((venue: { name: string }) => venue.name);
    expect(names).toContain('Dubai Mall');

    const distance = await request(app)
      .get('/api/v1/venues')
      .query({ latitude: 25.1972, longitude: 55.2796 })
      .set('Authorization', `Bearer ${token}`);
    expect(distance.status).toBe(200);
    expect(distance.body.data.venues[0].name).toBe('Dubai Mall');

    const inactive = await prisma.venue.create({
      data: {
        name: 'Hidden Venue',
        type: 'MALL',
        address: 'Hidden',
        latitude: 25.2,
        longitude: 55.3,
        country: 'AE',
        operatingHoursStart: '10:00',
        operatingHoursEnd: '22:00',
        isActive: false,
      },
    });
    const inactiveResponse = await request(app)
      .get('/api/v1/venues')
      .query({ q: 'Hi' })
      .set('Authorization', `Bearer ${token}`);
    const inactiveNames = inactiveResponse.body.data.venues.map(
      (venue: { name: string }) => venue.name,
    );
    expect(inactiveNames).not.toContain(inactive.name);
  });

  it('returns available slots when duo exists', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');

    const availability = await request(app)
      .get('/api/v1/availability')
      .query({ venueId: venue.id, date })
      .set('Authorization', `Bearer ${token}`);
    expect(availability.status).toBe(200);
    const availableSlots = availability.body.data.slots.filter(
      (slot: { available: boolean }) => slot.available,
    );
    expect(availableSlots.length).toBeGreaterThan(0);
  });

  it('returns unavailable slots when no duo is available', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(4, 'day').format('YYYY-MM-DD');

    const availability = await request(app)
      .get('/api/v1/availability')
      .query({ venueId: venue.id, date })
      .set('Authorization', `Bearer ${token}`);
    expect(availability.status).toBe(200);
    const allUnavailable = availability.body.data.slots.every(
      (slot: { available: boolean }) => !slot.available,
    );
    expect(allUnavailable).toBe(true);
  });

  it('enforces inter-booking buffer in availability', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.id, date, startTime });

    const availability = await request(app)
      .get('/api/v1/availability')
      .query({ venueId: venue.id, date })
      .set('Authorization', `Bearer ${token}`);
    const bufferSlot = availability.body.data.slots.find(
      (slot: { startTime: string }) => slot.startTime === '12:00',
    );
    expect(bufferSlot).toBeTruthy();
    expect(bufferSlot.available).toBe(false);
  });

  it('excludes soft-locked bookings from availability', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';
    const duo = await getDuoForDate(date);

    await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.PENDING,
      softLockExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const availability = await request(app)
      .get('/api/v1/availability')
      .query({ venueId: venue.id, date })
      .set('Authorization', `Bearer ${token}`);
    const lockedSlot = availability.body.data.slots.find(
      (slot: { startTime: string }) => slot.startTime === startTime,
    );
    expect(lockedSlot).toBeTruthy();
    expect(lockedSlot.available).toBe(false);
  });

  it('creates booking and confirms on happy path', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.id, date, startTime });
    expect(created.status).toBe(201);

    const status = await request(app)
      .get(`/api/v1/bookings/${created.body.data.bookingId}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body.data.status).toBe(BookingStatus.CONFIRMED);
  });

  it('returns 409 when client already has an active booking', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.id, date, startTime });

    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.id, date, startTime });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_BOOKING_EXISTS');
  });

  it('handles concurrent booking race for the same slot', async () => {
    const venue = await getSeededVenue();
    const clientA = await getSeededClient(0);
    const clientB = await getSeededClient(1);
    const tokenA = getAuthToken(clientA.id);
    const tokenB = getAuthToken(clientB.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const [resA, resB] = await Promise.all([
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ venueId: venue.id, date, startTime }),
      request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ venueId: venue.id, date, startTime }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it('fails pending bookings after soft-lock expiry', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';
    const duo = await getDuoForDate(date);

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.PENDING,
      softLockExpiresAt: new Date(Date.now() - 60 * 1000),
    });

    await runSoftLockExpiry();

    const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const refreshedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(refreshed.status).toBe(BookingStatus.FAILED);
    expect(refreshedClient.bookingStatusCache).toBe('NONE');
  });

  it('cancels with full refund when 25h before start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const now = nowBusiness();
    const start = now.add(25, 'hour');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
    });

    const token = getAuthToken(client.id);
    const response = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'change of plans' });
    expect(response.status).toBe(200);
    expect(response.body.data.refundPercentage).toBe(100);
  });

  it('cancels with partial refund when 12h before start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const now = nowBusiness();
    const start = now.add(12, 'hour');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
    });

    const token = getAuthToken(client.id);
    const response = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'late cancellation' });
    expect(response.status).toBe(200);
    expect(response.body.data.refundPercentage).toBe(50);
  });

  it('cancels with no refund when 5h before start', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const now = nowBusiness();
    const start = now.add(5, 'hour');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
    });

    const token = getAuthToken(client.id);
    const response = await request(app)
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'too late' });
    expect(response.status).toBe(200);
    expect(response.body.data.refundPercentage).toBe(0);
  });

  it('allows admin booking with full auto allocation', async () => {
    const admin = await getSeededAdmin();
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAdminToken(admin.id, admin.role);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const response = await request(app)
      .post('/api/v1/admin')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client.id, venueId: venue.id, date, startTime });
    expect(response.status).toBe(201);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: response.body.data.bookingId },
    });
    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(booking.captainId).toBeTruthy();
    expect(booking.viceCaptainId).toBeTruthy();
  });

  it('allows admin booking with captain specified', async () => {
    const admin = await getSeededAdmin();
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAdminToken(admin.id, admin.role);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';
    const duo = await getAnyDuo();

    const response = await request(app)
      .post('/api/v1/admin')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: client.id,
        venueId: venue.id,
        date,
        startTime,
        captainId: duo.captainId,
      });
    expect(response.status).toBe(201);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: response.body.data.bookingId },
    });
    expect(booking.captainId).toBe(duo.captainId);
    expect(booking.allocationMode).toBe(AllocationMode.CAPTAIN_SPECIFIED);
  });

  it('resets duo status when admin reassigns a captain', async () => {
    const admin = await getSeededAdmin();
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAdminToken(admin.id, admin.role);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const duo = await getAnyDuo();
    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
    });

    const newCaptain = await createTestCompanion(CompanionRole.CAPTAIN);
    await prisma.shift.create({
      data: {
        companionId: newCaptain.id,
        date: parseBusinessDate(date).startOf('day').toDate(),
        startTime: '09:00',
        endTime: '15:00',
        status: 'SCHEDULED',
      },
    });

    const response = await request(app)
      .post(`/api/v1/admin/${booking.id}/reassign`)
      .set('Authorization', `Bearer ${token}`)
      .send({ captainId: newCaptain.id });
    expect(response.status).toBe(200);
    expect(response.body.data.duoStatus).toBe(DuoStatus.PENDING);

    const updated = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updated.captainId).toBe(newCaptain.id);
    expect(updated.duoStatus).toBe(DuoStatus.PENDING);
  });

  it('auto-cancels booking on duo breach at T-20m', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const now = nowBusiness();
    const start = now.add(10, 'minute');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
      duoStatus: DuoStatus.PENDING,
    });

    await runDuoBreach();

    const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.status).toBe(BookingStatus.CANCELLED);
    expect(refreshed.duoStatus).toBe(DuoStatus.BREACH);
    expect(refreshed.refundPercentage).toBe(100);
  });

  it('auto-completes booking on client no-show at T+15m', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const now = nowBusiness();
    const start = now.subtract(20, 'minute');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: duo.captainId,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
      duoStatus: DuoStatus.ACTIVATED,
      sessionStartedAt: null,
    });

    await runClientNoShow();

    const refreshed = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(refreshed.status).toBe(BookingStatus.COMPLETED);
    expect(refreshed.clientNoShow).toBe(true);
  });

  it('hides companion details before reveal and shows after', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const venue = await getSeededVenue();
    const client = await getSeededClient();
    const companion = await prisma.companion.findFirstOrThrow({
      where: { role: CompanionRole.CAPTAIN },
    });
    const now = nowBusiness();
    const start = now.add(6, 'hour');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: companion.id,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
    });

    vi.setSystemTime(start.subtract(5, 'hour').toDate());
    const beforeToken = jwt.sign(
      { sub: companion.id, role: 'COMPANION' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const before = await request(app)
      .get('/api/v1/companion/bookings')
      .set('Authorization', `Bearer ${beforeToken}`);
    expect(before.status).toBe(200);
    const beforeBooking = before.body.data.bookings.find(
      (item: { bookingId: string }) => item.bookingId === booking.id,
    );
    expect(beforeBooking.isDetailRevealed).toBe(false);
    expect(beforeBooking.venue).toBeNull();
    expect(beforeBooking.clientNickname).toBeNull();

    vi.setSystemTime(start.subtract(3, 'hour').toDate());
    const afterToken = jwt.sign(
      { sub: companion.id, role: 'COMPANION' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const after = await request(app)
      .get(`/api/v1/companion/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${afterToken}`);
    expect(after.status).toBe(200);
    expect(after.body.data.venue).not.toBeNull();
    expect(after.body.data.clientNickname).toBe(client.nickname);
  });

  it('reveals client QR/PIN and companion duo codes at T-30m', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T08:00:00Z'));
    await seedDatabase();

    const venue = await getSeededVenue();
    const client = await getSeededClient();
    const companion = await prisma.companion.findFirstOrThrow({
      where: { role: CompanionRole.CAPTAIN },
    });
    const now = nowBusiness();
    const start = now.add(2, 'hour');
    const date = start.format('YYYY-MM-DD');
    const startTime = start.format('HH:mm');
    const duo = await getAnyDuo();

    const booking = await createBookingRecord({
      clientId: client.id,
      venueId: venue.id,
      captainId: companion.id,
      viceCaptainId: duo.viceCaptainId,
      date,
      startTime,
      status: BookingStatus.CONFIRMED,
    });

    vi.setSystemTime(start.subtract(31, 'minute').toDate());
    const beforeClientToken = jwt.sign(
      { sub: client.id, role: 'CLIENT' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const beforeCompanionToken = jwt.sign(
      { sub: companion.id, role: 'COMPANION' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const before = await request(app)
      .get(`/api/v1/bookings/${booking.id}/details`)
      .set('Authorization', `Bearer ${beforeClientToken}`);
    expect(before.status).toBe(200);
    expect(before.body.data.qrCode).toBeNull();
    expect(before.body.data.pinCode).toBeNull();

    const beforeCompanion = await request(app)
      .get(`/api/v1/companion/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${beforeCompanionToken}`);
    expect(beforeCompanion.status).toBe(200);
    expect(beforeCompanion.body.data.duoQrCode).toBeNull();
    expect(beforeCompanion.body.data.duoPinCode).toBeNull();

    vi.setSystemTime(start.subtract(30, 'minute').toDate());
    const afterClientToken = jwt.sign(
      { sub: client.id, role: 'CLIENT' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const afterCompanionToken = jwt.sign(
      { sub: companion.id, role: 'COMPANION' },
      process.env.JWT_SECRET ?? 'test',
      { expiresIn: '8h' },
    );
    const after = await request(app)
      .get(`/api/v1/bookings/${booking.id}/details`)
      .set('Authorization', `Bearer ${afterClientToken}`);
    expect(after.status).toBe(200);
    expect(after.body.data.qrCode).toBeTruthy();
    expect(after.body.data.pinCode).toBeTruthy();

    const afterCompanion = await request(app)
      .get(`/api/v1/companion/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${afterCompanionToken}`);
    expect(afterCompanion.status).toBe(200);
    expect(afterCompanion.body.data.duoQrCode).toBeTruthy();
    expect(afterCompanion.body.data.duoPinCode).toBeTruthy();
  });

  it('marks booking failed when payment hold fails', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const holdSpy = vi
      .spyOn(paymentService, 'holdAmount')
      .mockRejectedValueOnce(new Error('PAYMENT_FAILED'));

    const response = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ venueId: venue.id, date, startTime });
    expect(response.status).toBe(500);

    const booking = await prisma.booking.findFirst({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    });
    const refreshedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(booking?.status).toBe(BookingStatus.FAILED);
    expect(refreshedClient.bookingStatusCache).toBe('NONE');
    holdSpy.mockRestore();
  });

  it('returns cached response for idempotent booking requests', async () => {
    const client = await getSeededClient();
    const venue = await getSeededVenue();
    const token = getAuthToken(client.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';
    const idempotencyKey = `idem-${Date.now()}`;

    const first = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ venueId: venue.id, date, startTime });
    const second = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ venueId: venue.id, date, startTime });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.bookingId).toBe(first.body.data.bookingId);

    const count = await prisma.booking.count({ where: { clientId: client.id } });
    expect(count).toBe(1);
  });

  it('returns 403 when accessing another client booking', async () => {
    const venue = await getSeededVenue();
    const clientA = await getSeededClient(0);
    const clientB = await getSeededClient(1);
    const tokenA = getAuthToken(clientA.id);
    const tokenB = getAuthToken(clientB.id);
    const date = dayjs().add(2, 'day').format('YYYY-MM-DD');
    const startTime = '10:00';

    const created = await request(app)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ venueId: venue.id, date, startTime });
    expect(created.status).toBe(201);

    const denied = await request(app)
      .get(`/api/v1/bookings/${created.body.data.bookingId}/status`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('OWNERSHIP_MISMATCH');
  });
});
