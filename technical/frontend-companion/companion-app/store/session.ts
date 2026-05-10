import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { apiClient } from '@/lib/api-client';
import type { SessionUser } from '@/lib/api/auth';

const TOKEN_KEY = 'auth_token';

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
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    apiClient.setToken(token);
    set({ user, token, isLoading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    apiClient.setToken(null);
    set({ user: null, token: null, isLoading: false });
  },

  setLoading: (isLoading) => set({ isLoading }),
}));

/** Read persisted token from SecureStore. Returns null if absent. */
export async function readPersistedToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
