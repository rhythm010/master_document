import type { BookingRatingType } from "@prisma/client";

export type CreateBookingRatingInput = {
  bookingId: string;
  caller: {
    id: string;
    role: "CLIENT" | "COMPANION";
  };
  stars: number | null | undefined;
  tags: string[];
  comment: string | null | undefined;
};

export type BookingRatingDTO = {
  id: string;
  bookingId: string;
  raterUserId: string;
  ratingType: BookingRatingType;
  stars: number | null;
  tags: string[];
  comment: string;
  createdAt: string;
};

export type CreateBookingRatingResult = {
  status: 200 | 201;
  rating: BookingRatingDTO;
};
