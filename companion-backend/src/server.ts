import express from 'express';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestLogger } from './middleware/request-logger';
import { errorHandler } from './middleware/error-handler';
import { authenticate } from './middleware/authenticate';
import { authorize } from './middleware/authorize';
import authRoutes from './modules/auth/auth.routes';
import venueRoutes from './modules/venue/venue.routes';
import availabilityRoutes from './modules/availability/availability.routes';
import bookingRoutes from './modules/booking/booking.routes';
import adminRoutes from './modules/admin/admin.routes';
import companionRoutes from './modules/companion/companion.routes';
import { startSchedulers } from './schedulers';

const app = express();

app.use(requestLogger);
app.use(express.json());

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/venues', authenticate, authorize('CLIENT'), venueRoutes);
app.use('/api/v1/availability', authenticate, authorize('CLIENT'), availabilityRoutes);
app.use('/api/v1/bookings', authenticate, authorize('CLIENT'), bookingRoutes);
app.use('/api/v1/admin', authenticate, adminRoutes);
app.use('/api/v1/companion', authenticate, companionRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Server started');
  startSchedulers();
});
