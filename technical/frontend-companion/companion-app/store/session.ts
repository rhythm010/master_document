import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiClient } from '@/lib/api-client';
import type { SessionUser } from '@/lib/api/auth';
import { invalidateAppStateSyncAndRouteCache } from '@/lib/app-state/sync-and-route';
import { useAppStateStore } from '@/store/app-state';

const TOKEN_KEY = 'auth_token';

/** Persist token; falls back to localStorage on web where SecureStore has no implementation. */
async function persistToken(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(TOKEN_KEY, value); } catch { /* ignore */ }
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  }
}

/** Remove persisted token; falls back to localStorage on web. */
async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/** Read persisted token; falls back to localStorage on web. Returns null on any error. */
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  } else {
    try { return await SecureStore.getItemAsync(TOKEN_KEY); } catch { return null; }
  }
}

interface SessionState {
  user: SessionUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: SessionUser) => Promise<void>;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  token: null,
  isLoading: false,

  login: async (token, user) => {
    // Token changes must invalidate any in-flight app-state sync to avoid cross-session reuse.
    invalidateAppStateSyncAndRouteCache();
    await persistToken(token);
    apiClient.setToken(token);
    set({ user, token, isLoading: false });
  },

  logout: async () => {
    // Ensure logout invalidates any in-flight app-state sync.
    invalidateAppStateSyncAndRouteCache();
    await clearToken();
    apiClient.setToken(null);
    // Clear any cached app-state so a new session starts from a clean slate.
    useAppStateStore.getState().clearAppState();
    set({ user: null, token: null, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

/** Read persisted token from secure storage. Returns null if absent or if storage is unavailable. */
export async function readPersistedToken(): Promise<string | null> {
  return getToken();
}
