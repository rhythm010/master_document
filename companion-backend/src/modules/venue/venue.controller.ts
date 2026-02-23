import { Request, Response } from 'express';
import { ok } from '../../shared/response';
import { listVenues } from './venue.service';

export async function listVenuesHandler(req: Request, res: Response) {
  const { q, latitude, longitude } = req.validated?.query as {
    q?: string;
    latitude?: number;
    longitude?: number;
  };

  const venues = await listVenues({ q, latitude, longitude });
  return ok(res, { venues });
}
