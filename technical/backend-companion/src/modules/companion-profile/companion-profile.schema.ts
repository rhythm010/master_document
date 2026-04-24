import { z } from "zod";

export const updateProfileSchema = z
  .object({
    languages: z.array(z.string()).max(10).optional(),
    profilePictureUrl: z.string().optional()
  })
  .refine((data) => data.languages !== undefined || data.profilePictureUrl !== undefined, {
    message: "No fields provided"
  });

export const toggleActiveSchema = z.object({
  isActive: z.boolean()
});
