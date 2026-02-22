import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authorize } from '../../middleware/authorize';
import {
  adminBookingIdSchema,
  adminCreateBookingSchema,
  adminReassignSchema,
} from './admin.schemas';
import {
  cancelAdminBooking,
  createAdminBooking,
  reassignBooking,
} from './admin.controller';
import { asyncHandler } from '../../shared/async-handler';

const router = Router();

router.post(
  '/',
  authorize('SUPER_ADMIN', 'OPERATIONS'),
  validate(adminCreateBookingSchema),
  asyncHandler(createAdminBooking),
);
router.post(
  '/:id/cancel',
  authorize('SUPER_ADMIN', 'OPERATIONS'),
  validate(adminBookingIdSchema),
  asyncHandler(cancelAdminBooking),
);
router.post(
  '/:id/reassign',
  authorize('SUPER_ADMIN', 'OPERATIONS'),
  validate(adminReassignSchema),
  asyncHandler(reassignBooking),
);

export default router;
