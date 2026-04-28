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

export type BookingDetailsDTO = {
  id: string;
  status: "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  clientId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  createdAt: string;
};
