export type ExtendBookingResponseDTO = {
  id: string;
  status: "ACTIVE";
  endAt: string;
  extendedAt: string;
};

export type SosBookingResponseDTO = Record<string, never>;

export type BookingSessionResponseDTO = {
  id: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startAt: string;
  endAt: string;
  extendedAt: string | null;
  nearEndNotifiedAt: string | null;
  myDesignation: "CAPTAIN" | "VICE_CAPTAIN" | null;
};

export type BookingMessageDTO = {
  id: string;
  bookingId: string;
  senderUserId: string;
  content: string;
  createdAt: string;
};

export type ListBookingMessagesResponseDTO = {
  bookingId: string;
  messages: BookingMessageDTO[];
};

export type CreateBookingMessageResponseDTO = BookingMessageDTO;
