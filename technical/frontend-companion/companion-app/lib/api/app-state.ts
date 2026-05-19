import { apiClient } from '@/lib/api-client';

export type NextAction =
  | 'ACTIVE_SESSION'
  | 'MATCHING'
  | 'RATING_NEEDED'
  | 'COMPANION_INACTIVE'
  | 'IDLE';

export type AppStateResponse = {
  user: {
    id: string;
    role: 'CLIENT' | 'COMPANION';
    companionProfile: { isActive: boolean } | null;
  };
  primaryBooking: {
    id: string;
    status: 'ACTIVE' | 'CONFIRMED';
    startAt: string;
    endAt: string;
  } | null;
  ratingNeeded: {
    bookingId: string;
    status: 'COMPLETED' | 'CANCELLED';
    startAt: string;
  } | null;
  nextAction: NextAction;
};

/** Fetch the backend-authoritative routing state for the authenticated user. */
export function getMyAppState() {
  return apiClient.get<AppStateResponse>('/users/me/app-state');
}
