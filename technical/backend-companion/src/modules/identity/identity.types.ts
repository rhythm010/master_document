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
