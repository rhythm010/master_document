import { z } from "zod";

export const createBookingSchema = z.object({
  venueId: z.string().uuid(),
  startAt: z.string().min(1)
});

export const cancelBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const bookingDetailsParamsSchema = z.object({
  id: z.string().uuid()
});

export const internalEditBookingParamsSchema = z.object({
  id: z.string().uuid()
});

export const internalEditBookingBodySchema = z
  .object({
    venueId: z.string().uuid().optional(),
    startAt: z.string().min(1).optional(),
    captainCompanionId: z.string().uuid().optional(),
    viceCaptainCompanionId: z.string().uuid().optional()
  })
  .refine(
    (data) =>
      data.venueId !== undefined ||
      data.startAt !== undefined ||
      data.captainCompanionId !== undefined ||
      data.viceCaptainCompanionId !== undefined,
    {
      message: "No fields provided"
    }
  )
  .refine(
    (data) => {
      const hasCaptain = data.captainCompanionId !== undefined;
      const hasVice = data.viceCaptainCompanionId !== undefined;
      return hasCaptain === hasVice;
    },
    {
      message: "Both captainCompanionId and viceCaptainCompanionId must be provided together"
    }
  );

