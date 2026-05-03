export type BookingStatus = "CONFIRMED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type CompanionSummaryDTO = {
  id: string;
  displayName: string;
  languages: string[];
  averageRating: number;
  profilePictureUrl: string;
};

export type CompanionLocationDTO = {
  companionId: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
};

export type ClientLocationDTO = {
  latitude: number;
  longitude: number;
  updatedAt: string;
};

export type ComMatchContextResponseDTO =
  | {
      bookingId: string;
      comMatchQrCode: string;
      comMatchPinCode: string;
    }
  | {
      bookingId: string;
      scannerEnabled: true;
    };

export type ComMatchVerifyResponseDTO = {
  bookingId: string;
  selfMatchStatus: "MATCHED";
};

export type MatchingContextClientDTO = {
  bookingId: string;
  bookingStatus: BookingStatus;
  bookingColor: string;
  companions: CompanionSummaryDTO[];
  companionLocations: CompanionLocationDTO[];
  qrCode: string;
  pinCode: string;
  clientMatchStarted: boolean;
};

export type MatchingContextCompanionDTO = {
  bookingId: string;
  bookingStatus: BookingStatus;
  bookingColor: string;
  clientNickname: string;
  clientMatchStarted: boolean;
  canVerifyClientMatch: boolean;
  clientLocation?: ClientLocationDTO;
};

export type MatchingContextResponseDTO = MatchingContextClientDTO | MatchingContextCompanionDTO;

export type ClientMatchStartResponseDTO = {
  bookingId: string;
  clientMatchStarted: true;
  locationSharingState: "TWO_WAY";
};

export type MatchingLocationResponseDTO = {
  bookingId: string;
  updatedAt: string;
};

export type ClientMatchVerifyResponseDTO = {
  bookingId: string;
  bookingStatus: "ACTIVE";
  clientMatchStatus: "CLIENT_MATCHED";
};
