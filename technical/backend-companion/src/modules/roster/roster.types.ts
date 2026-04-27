import type { VenueType } from "@prisma/client";

export type VenueListItemDTO = {
  id: string;
  name: string;
  address: string;
  venueType: VenueType;
  latitude: number;
  longitude: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
};

export type ListVenuesResponseDTO = {
  items: VenueListItemDTO[];
};

export type AvailabilityResponseDTO = {
  venueId: string;
  date: string;
  durationMinutes: number;
  availableStartTimes: string[];
};

export type ReserveSlotsResponseDTO = {
  reserved: true;
  captainSlotId: string;
  viceCaptainSlotId: string;
};

export type ReleaseSlotsResponseDTO = {
  released: true;
  slotsReleased: number;
};

export type PopulateForCompanionResponseDTO = {
  companionId: string;
  slotsCreated: number;
};
