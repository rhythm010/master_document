import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { availabilitySchema } from './availability.schemas';
import { getAvailabilityHandler } from './availability.controller';
import { asyncHandler } from '../../shared/async-handler';

const router = Router();

router.get('/', validate(availabilitySchema), asyncHandler(getAvailabilityHandler));

export default router;
