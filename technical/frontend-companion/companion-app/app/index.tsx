import React from 'react';
import { useRouter } from 'expo-router';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getMe } from '@/lib/api/auth';
import { apiClient } from '@/lib/api-client';
import { readPersistedToken, useSessionStore } from '@/store/session';

export default function SessionRestore() {
  const router = useRouter();
  const { login, logout, setLoading } = useSessionStore();

  React.useEffect(() => {
    async function restore() {
      setLoading(true);
      const token = await readPersistedToken();

      if (!token) {
        setLoading(false);
        router.replace('/(auth)/login');
        return;
      }

      try {
        apiClient.setToken(token);
        const user = await getMe();
        await login(token, user);
        router.replace(user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home');
      } catch {
        // Any error (401, network error, timeout) clears the session and returns to login.
        await logout();
        router.replace('/(auth)/login');
      }
    }

    restore();
  }, [login, logout, router, setLoading]);

  return <LoadingScreen />;
}
