import { z } from "zod";

const bookingIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const extendBookingParamsSchema = bookingIdParamsSchema;

export const sosBookingParamsSchema = bookingIdParamsSchema;

export const bookingSessionParamsSchema = bookingIdParamsSchema;

export const bookingMessagesParamsSchema = bookingIdParamsSchema;

export const createBookingMessageSchema = z
  .object({
    content: z.string().min(1),
    senderUserId: z.any().optional()
  })
  .superRefine((data, ctx) => {
    if (data.senderUserId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "senderUserId is not allowed"
      });
    }
  });
