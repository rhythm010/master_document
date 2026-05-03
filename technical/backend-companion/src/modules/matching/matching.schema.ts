import { z } from "zod";

export const matchingBookingParamsSchema = z.object({
  bookingId: z.string().uuid()
});

export const comMatchVerifySchema = z
  .object({
    verificationMethod: z.enum(["QR", "PIN"]),
    qrCode: z.string().min(1).optional(),
    pinCode: z.string().min(1).optional()
  })
  .superRefine((data, ctx) => {
    if (data.verificationMethod === "QR" && !data.qrCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "qrCode is required for QR verification" });
    }

    if (data.verificationMethod === "PIN" && !data.pinCode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "pinCode is required for PIN verification" });
    }
  });

export const clientMatchVerifySchema = comMatchVerifySchema;

export const clientMatchStartSchema = z.object({
  latitude: z.any().optional(),
  longitude: z.any().optional(),
  gpsPermissionGranted: z.boolean(),
  gpsEnabled: z.boolean()
});

export const matchingLocationSchema = z.object({
  latitude: z.any().optional(),
  longitude: z.any().optional(),
  gpsPermissionGranted: z.boolean().optional(),
  gpsEnabled: z.boolean().optional()
});
