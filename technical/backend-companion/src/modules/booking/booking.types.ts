export type CreateBookingRequestDTO = {
  clientId: string;
  venueId: string;
  startAt: string;
};

export type BookingSummaryDTO = {
  id: string;
  status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  clientId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  createdAt: string;
};

export type CancelBookingResponseDTO = {
  id: string;
  status: "CANCELLED";
};

export type BookingCompanionPublicInfoDTO = {
  designation: "CAPTAIN" | "VICE_CAPTAIN";
  displayName: string;
  languages: string[];
  profilePictureUrl: string;
  averageRating: number;
};

export type BookingDetailsDTO = {
  id: string;
  status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  clientId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  companions: BookingCompanionPublicInfoDTO[] | null;
};

export type InternalEditBookingRequestDTO = {
  bookingId: string;
  venueId?: string;
  startAt?: string;
  captainCompanionId?: string;
  viceCaptainCompanionId?: string;
};

