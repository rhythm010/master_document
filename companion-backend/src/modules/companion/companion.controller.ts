import { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { listCompanionBookings, getCompanionBooking } from './companion.service';

export async function listBookings(req: Request, res: Response) {
  const data = await listCompanionBookings(req.user!.id);
  return ok(res, { bookings: data });
}

export async function getBooking(req: Request, res: Response) {
  const { id } = req.validated?.params as { id: string };
  const data = await getCompanionBooking(req.user!.id, id);
  return ok(res, data);
}
