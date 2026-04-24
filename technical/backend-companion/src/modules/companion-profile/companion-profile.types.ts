import type { CompanionDesignation } from "../../shared/types/enums";

export type CompanionProfileDTO = {
  id: string;
  userId: string;
  designation: CompanionDesignation;
  isActive: boolean;
  languages: string[];
  profilePictureUrl: string;
  averageRating: number;
};
