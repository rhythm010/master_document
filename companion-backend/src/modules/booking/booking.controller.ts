import { Request, Response } from 'express';
import { created, ok } from '../../shared/response';
import * as bookingService from './booking.service';

export async function createBooking(req: Request, res: Response) {
  const { venueId, date, startTime } = req.validated?.body as {
    venueId: string;
    date: string;
    startTime: string;
  };

  const data = await bookingService.createBooking(
    req.user!.id,
    { venueId, date, startTime },
    {
      idempotencyKey: req.headers['idempotency-key'] as string | undefined,
      deviceId: req.headers['x-device-id'] as string | undefined,
      clientLatitude: req.headers['x-client-latitude']
        ? Number(req.headers['x-client-latitude'])
        : undefined,
      clientLongitude: req.headers['x-client-longitude']
        ? Number(req.headers['x-client-longitude'])
        : undefined,
    },
  );

  return created(res, {
    ...data,
    softLockExpiresAt: data.softLockExpiresAt?.toISOString() ?? null,
    pricing: {
      ...data.pricing,
      baseRate: data.pricing.baseRate.toString(),
      vatAmount: data.pricing.vatAmount.toString(),
      serviceFee: data.pricing.serviceFee.toString(),
      grandTotal: data.pricing.grandTotal.toString(),
    },
  });
}

export async function getBookingStatus(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const data = await bookingService.getBookingStatus(req.user!.id, id);
  return ok(res, {
    bookingId: data.bookingId,
    status: data.status,
    duoStatus: data.duoStatus,
    softLockExpiresAt: data.softLockExpiresAt,
  });
}

export async function getBookingDetails(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const data = await bookingService.getBookingDetails(req.user!.id, id);
  return ok(res, {
    ...data,
    pricing: {
      ...data.pricing,
      baseRate: data.pricing.baseRate.toString(),
      vatAmount: data.pricing.vatAmount.toString(),
      serviceFee: data.pricing.serviceFee.toString(),
      grandTotal: data.pricing.grandTotal.toString(),
    },
    createdAt: data.createdAt.toISOString(),
  });
}

export async function cancelBooking(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const { reason } = req.validated?.body as { reason?: string };
  const data = await bookingService.cancelBooking(req.user!.id, id, reason);
  const refundPercentage = Number(data.refundPercentage);
  return ok(res, {
    bookingId: data.bookingId,
    status: data.status,
    refundPercentage,
    refundAmount: data.refundAmount.toString(),
    message:
      refundPercentage === 100
        ? 'Booking cancelled. Full refund will be processed.'
        : refundPercentage === 50
        ? 'Booking cancelled. Partial refund will be processed.'
        : 'Booking cancelled. No refund will be issued.',
  });
}

export async function getCurrentBooking(req: Request, res: Response) {
  const data = await bookingService.getCurrentBooking(req.user!.id);
  return ok(res, data);
}
