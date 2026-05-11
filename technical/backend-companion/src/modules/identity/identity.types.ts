import type { UserRole, CompanionDesignation } from "../../shared/types/enums";

export type CompanionProfileDTO = {
  id: string;
  userId: string;
  designation: CompanionDesignation;
  isActive: boolean;
  languages: string[];
  profilePictureUrl: string;
  averageRating: number;
};

export type PublicUserDTO = {
  id: string;
  role: UserRole;
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
  biometricAuthEnabled: boolean;
  createdAt: Date;
  companionProfile?: CompanionProfileDTO;
};

export type NextAction =
  | "ACTIVE_SESSION"
  | "MATCHING"
  | "RATING_NEEDED"
  | "COMPANION_INACTIVE"
  | "IDLE";

export type AppStateResponseDTO = {
  user: {
    id: string;
    role: UserRole;
    companionProfile: { isActive: boolean } | null;
  };
  primaryBooking: {
    id: string;
    status: "ACTIVE" | "CONFIRMED";
    startAt: string;
    endAt: string;
  } | null;
  ratingNeeded: {
    bookingId: string;
    status: "COMPLETED" | "CANCELLED";
    startAt: string;
  } | null;
  nextAction: NextAction;
};
