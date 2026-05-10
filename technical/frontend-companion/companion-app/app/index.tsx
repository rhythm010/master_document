import React from 'react';
import { usePathname, useRouter } from 'expo-router';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getMe } from '@/lib/api/auth';
import { apiClient } from '@/lib/api-client';
import { readPersistedToken, useSessionStore } from '@/store/session';

export default function SessionRestore() {
  const router = useRouter();
  const pathname = usePathname();
  const { login, logout, setLoading } = useSessionStore();
  // Guard to ensure session restore runs exactly once on mount, regardless of
  // subsequent pathname changes caused by router.replace calls after login.
  const hasRestoredRef = React.useRef(false);

  React.useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    async function restore() {
      setLoading(true);
      const token = await readPersistedToken();

      if (!token) {
        setLoading(false);
        // Allow verify-email deep links to proceed without redirect to login
        if (!pathname.includes('verify-email')) {
          router.replace('/(auth)/login');
        }
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
  }, [login, logout, pathname, router, setLoading]);

  return <LoadingScreen />;
}
