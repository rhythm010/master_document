import { create } from 'zustand';
import type { AppStateResponse } from '@/lib/api/app-state';

interface AppStateStore {
  appState: AppStateResponse | null;
  setAppState: (appState: AppStateResponse) => void;
  clearAppState: () => void;
}

/** Global store for the latest backend-driven app-state (nextAction + primaryBooking). */
export const useAppStateStore = create<AppStateStore>((set) => ({
  appState: null,
  setAppState: (appState) => set({ appState }),
  clearAppState: () => set({ appState: null }),
}));
