import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { listVenuesSchema } from './venue.schemas';
import { listVenuesHandler } from './venue.controller';
import { asyncHandler } from '../../shared/async-handler';

const router = Router();

router.get('/', validate(listVenuesSchema), asyncHandler(listVenuesHandler));

export default router;
