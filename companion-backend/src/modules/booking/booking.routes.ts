import { Router } from 'express';
import { validate } from '../../middleware/validate';
import {
  bookingIdParamsSchema,
  cancelBookingSchema,
  createBookingSchema,
} from './booking.schemas';
import {
  cancelBooking,
  createBooking,
  getBookingDetails,
  getBookingStatus,
  getCurrentBooking,
} from './booking.controller';
import { asyncHandler } from '../../shared/async-handler';

const router = Router();

router.post('/', validate(createBookingSchema), asyncHandler(createBooking));
router.get('/current', asyncHandler(getCurrentBooking));
router.get('/:id/status', validate(bookingIdParamsSchema), asyncHandler(getBookingStatus));
router.get('/:id/details', validate(bookingIdParamsSchema), asyncHandler(getBookingDetails));
router.post('/:id/cancel', validate(cancelBookingSchema), asyncHandler(cancelBooking));

export default router;
