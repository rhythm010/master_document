import { ActorType, NotificationType, ShiftStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { nowBusiness, buildBusinessDateTime, formatBusinessDate } from '../shared/utils';
import { sendNotification } from '../services/notification.service';

export async function runBatteryCheck() {
  const now = nowBusiness();
  const windowStart = now.add(4, 'hour');
  const windowEnd = now.add(5, 'hour');

  const shifts = await prisma.shift.findMany({
    where: {
      status: { in: [ShiftStatus.SCHEDULED, ShiftStatus.ACTIVE] },
    },
    include: { companion: true },
  });

  const due = shifts.filter((shift) => {
    const shiftDate = formatBusinessDate(shift.date);
    const shiftStart = buildBusinessDateTime(shiftDate, shift.startTime);
    return (shiftStart.isAfter(windowStart) || shiftStart.isSame(windowStart)) && shiftStart.isBefore(windowEnd);
  });

  for (const shift of due) {
    await sendNotification({
      recipientType: ActorType.COMPANION,
      recipientId: shift.companionId,
      notificationType: NotificationType.BATTERY_CHECK,
    });
  }

  if (due.length > 0) {
    logger.info({ count: due.length }, 'Battery check notifications queued');
  }
}
