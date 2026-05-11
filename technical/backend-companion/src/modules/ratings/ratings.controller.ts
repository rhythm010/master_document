import type { Request, Response } from "express";

import { asyncHandler } from "../../shared/utils/asyncHandler";

import {
  bookingRatingStatusParamsSchema,
  createBookingRatingBodySchema,
  createBookingRatingParamsSchema
} from "./ratings.schema";
import { ratingsService } from "./ratings.service";

export const ratingsController = {
  // Create a new booking rating from the authenticated caller.
  createBookingRating: asyncHandler(async (req: Request, res: Response) => {
    const params = createBookingRatingParamsSchema.parse(req.params);
    const body = createBookingRatingBodySchema.parse(req.body);

    const result = await ratingsService.createBookingRating({
      bookingId: params.id,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      },
      stars: body.stars,
      tags: body.tags,
      comment: body.comment
    });

    res.status(result.status).json(result.rating);
  }),

  // Return the rating eligibility/submission status for this booking + caller.
  getBookingRatingStatus: asyncHandler(async (req: Request, res: Response) => {
    const params = bookingRatingStatusParamsSchema.parse(req.params);

    const result = await ratingsService.getBookingRatingStatus({
      bookingId: params.id,
      caller: {
        id: req.user!.id,
        role: req.user!.role
      }
    });

    res.status(200).json(result);
  })
};
