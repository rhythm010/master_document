"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
const logger_1 = require("../config/logger");
async function sendNotification(payload) {
    const channel = payload.channel ?? client_1.NotificationChannel.PUSH;
    await prisma_1.prisma.notificationLog.create({
        data: {
            recipientType: payload.recipientType,
            recipientId: payload.recipientId,
            bookingId: payload.bookingId,
            notificationType: payload.notificationType,
            channel,
            content: payload.content,
        },
    });
    logger_1.logger.info({
        recipientType: payload.recipientType,
        recipientId: payload.recipientId,
        bookingId: payload.bookingId,
        notificationType: payload.notificationType,
    }, 'Mock notification dispatched');
}
