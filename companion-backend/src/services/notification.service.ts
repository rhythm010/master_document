import { NotificationChannel, NotificationType, ActorType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export type NotificationPayload = {
  recipientType: ActorType;
  recipientId: string;
  bookingId?: string;
  notificationType: NotificationType;
  channel?: NotificationChannel;
  content?: string;
};

export async function sendNotification(payload: NotificationPayload) {
  const channel = payload.channel ?? NotificationChannel.PUSH;
  await prisma.notificationLog.create({
    data: {
      recipientType: payload.recipientType,
      recipientId: payload.recipientId,
      bookingId: payload.bookingId,
      notificationType: payload.notificationType,
      channel,
      content: payload.content,
    },
  });
  logger.info(
    {
      recipientType: payload.recipientType,
      recipientId: payload.recipientId,
      bookingId: payload.bookingId,
      notificationType: payload.notificationType,
    },
    'Mock notification dispatched',
  );
}
