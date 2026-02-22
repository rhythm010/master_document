import cron from 'node-cron';
import { runSoftLockExpiry } from './soft-lock-expiry.job';
import { runDuoBreach } from './duo-breach.job';
import { runClientNoShow } from './client-no-show.job';
import { runBookingDetailReveal } from './booking-detail-reveal.job';
import { runBatteryCheck } from './battery-check.job';
import { runLocationLogCleanup } from './location-log-cleanup.job';

export function startSchedulers() {
  cron.schedule('* * * * *', runSoftLockExpiry);
  cron.schedule('* * * * *', runDuoBreach);
  cron.schedule('* * * * *', runClientNoShow);
  cron.schedule('*/5 * * * *', runBookingDetailReveal);
  cron.schedule('0 * * * *', runBatteryCheck);
  cron.schedule('0 3 * * *', runLocationLogCleanup);
}
