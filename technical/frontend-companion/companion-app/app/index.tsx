import React from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { getMe, type SessionUser } from '@/lib/api/auth';
import { getMyAppState } from '@/lib/api/app-state';
import { apiClient, AppApiError } from '@/lib/api-client';
import { syncAndRoute } from '@/lib/app-state/sync-and-route';
import { readPersistedToken, useSessionStore } from '@/store/session';

/** Entry screen that restores a persisted session (if any) and routes via backend app-state. */
export default function SessionRestore() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { login, logout, setLoading } = useSessionStore();
  const [restoreError, setRestoreError] = React.useState<string | null>(null);

  // Guard to ensure session restore runs exactly once on mount, regardless of
  // subsequent pathname changes caused by router.replace calls after login.
  const hasRestoredRef = React.useRef(false);

  const restore = React.useCallback(async () => {
    setRestoreError(null);
    setLoading(true);

    const token = await readPersistedToken();

    if (!token) {
      setLoading(false);
      // Allow verify-email deep links to proceed without redirect to login.
      if (!pathname.includes('verify-email')) {
        router.replace('/(auth)/login');
      }
      return;
    }

    apiClient.setToken(token);

    try {
      const user = await getMe();
      await login(token, user);

      const result = await syncAndRoute({
        router,
        pathname,
        segments,
        token,
        logout,
        roleForFallback: user.role,
      });

      if (result.kind === 'non_auth_error') {
        setRestoreError('Cannot reach server. Please try again.');
      }
    } catch (err) {
      // 401/403 means the token is invalid/expired → clear session.
      if (err instanceof AppApiError && (err.status === 401 || err.status === 403)) {
        await logout();
        router.replace('/(auth)/login');
        return;
      }

      // Best-effort: if `/users/me` failed (e.g. 5xx), try restoring via app-state.
      try {
        const appState = await getMyAppState();
        const minimalUser: SessionUser = {
          id: appState.user.id,
          role: appState.user.role,
          name: '',
          nickname: '',
          email: '',
          emailVerified: false,
          biometricAuthEnabled: false,
        };

        await login(token, minimalUser);

        const result = await syncAndRoute({
          router,
          pathname,
          segments,
          token,
          logout,
          roleForFallback: minimalUser.role,
        });

        if (result.kind === 'non_auth_error') {
          setRestoreError('Cannot reach server. Please try again.');
        }
      } catch (err2) {
        if (err2 instanceof AppApiError && (err2.status === 401 || err2.status === 403)) {
          await logout();
          router.replace('/(auth)/login');
          return;
        }

        // Non-auth error: preserve persisted token and allow the user to retry.
        setRestoreError('Cannot reach server. Please try again.');
      }
    } finally {
      // `login()` / `logout()` also clear loading, but ensure we never leave the app stuck in a loading state.
      setLoading(false);
    }
  }, [login, logout, pathname, router, segments, setLoading]);

  React.useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    void restore();
  }, [restore]);

  if (restoreError) {
    return <ErrorScreen message={restoreError} onRetry={() => void restore()} />;
  }

  return <LoadingScreen />;
}
