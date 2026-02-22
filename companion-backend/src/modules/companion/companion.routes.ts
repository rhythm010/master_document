import { Router } from 'express';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { companionBookingParamsSchema } from './companion.schemas';
import { getBooking, listBookings } from './companion.controller';
import { asyncHandler } from '../../shared/async-handler';

const router = Router();

router.get('/bookings', authorize('COMPANION'), asyncHandler(listBookings));
router.get(
  '/bookings/:id',
  authorize('COMPANION'),
  validate(companionBookingParamsSchema),
  asyncHandler(getBooking),
);

export default router;
