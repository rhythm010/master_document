"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatteryCheck = runBatteryCheck;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const logger_1 = require("../config/logger");
const utils_1 = require("../shared/utils");
const notification_service_1 = require("../services/notification.service");
async function runBatteryCheck() {
    const now = (0, utils_1.nowBusiness)();
    const windowStart = now.add(4, 'hour');
    const windowEnd = now.add(5, 'hour');
    const shifts = await prisma_1.prisma.shift.findMany({
        where: {
            status: { in: [client_1.ShiftStatus.SCHEDULED, client_1.ShiftStatus.ACTIVE] },
        },
        include: { companion: true },
    });
    const due = shifts.filter((shift) => {
        const shiftDate = shift.date.toISOString().slice(0, 10);
        const shiftStart = (0, utils_1.buildBusinessDateTime)(shiftDate, shift.startTime);
        return (shiftStart.isAfter(windowStart) || shiftStart.isSame(windowStart)) && shiftStart.isBefore(windowEnd);
    });
    for (const shift of due) {
        await (0, notification_service_1.sendNotification)({
            recipientType: client_1.ActorType.COMPANION,
            recipientId: shift.companionId,
            notificationType: client_1.NotificationType.BATTERY_CHECK,
        });
    }
    if (due.length > 0) {
        logger_1.logger.info({ count: due.length }, 'Battery check notifications queued');
    }
}
