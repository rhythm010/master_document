import { Request, Response } from 'express';
import { created, ok } from '../../shared/response';
import * as adminService from './admin.service';

export async function createAdminBooking(req: Request, res: Response) {
  const { clientId, venueId, date, startTime, captainId, viceCaptainId } =
    req.validated?.body as {
      clientId: string;
      venueId: string;
      date: string;
      startTime: string;
      captainId?: string | null;
      viceCaptainId?: string | null;
    };

  const data = await adminService.createAdminBooking(req.user!.id, {
    clientId,
    venueId,
    date,
    startTime,
    captainId,
    viceCaptainId,
  });

  return created(res, {
    bookingId: data.booking.id,
    status: data.booking.status,
    pricing: {
      baseRate: data.pricing.baseRate.toString(),
      vatAmount: data.pricing.vatAmount.toString(),
      serviceFee: data.pricing.serviceFee.toString(),
      grandTotal: data.pricing.grandTotal.toString(),
      currency: data.pricing.currency,
    },
  });
}

export async function cancelAdminBooking(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const reason = (req.validated?.body as { reason?: string } | undefined)?.reason;
  const booking = await adminService.cancelAdminBooking(req.user!.id, id, reason);
  return ok(res, {
    bookingId: booking.id,
    status: booking.status,
    refundPercentage: 100,
    refundAmount: booking.refundAmount?.toString() ?? booking.grandTotal.toString(),
    message: 'Booking cancelled. Full refund will be processed.',
  });
}

export async function reassignBooking(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const { captainId, viceCaptainId } = req.validated?.body as {
    captainId?: string | null;
    viceCaptainId?: string | null;
  };
  const booking = await adminService.reassignBooking(req.user!.id, id, { captainId, viceCaptainId });
  return ok(res, {
    bookingId: booking.id,
    captainId: booking.captainId,
    viceCaptainId: booking.viceCaptainId,
    duoStatus: booking.duoStatus,
  });
}
