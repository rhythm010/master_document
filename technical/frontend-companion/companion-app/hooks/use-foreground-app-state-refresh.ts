import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { syncAndRoute } from '@/lib/app-state/sync-and-route';
import { useSessionStore } from '@/store/session';

/** Re-sync backend app-state when the app returns to the foreground (background→active). */
export function useForegroundAppStateRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const pathnameRef = React.useRef(pathname);
  const segmentsRef = React.useRef(segments);

  const { user, token, logout } = useSessionStore();

  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  React.useEffect(() => {
    if (!user) return;

    const lastStatusRef = { current: AppState.currentState };

    async function maybeSync(nextStatus: AppStateStatus) {
      const prev = lastStatusRef.current;
      lastStatusRef.current = nextStatus;

      if ((prev === 'background' || prev === 'inactive') && nextStatus === 'active') {
        try {
          await syncAndRoute({
            router,
            pathname: pathnameRef.current,
            segments: segmentsRef.current,
            token,
            logout,
          });
        } catch {
          // Foreground refresh must never crash the app via an unhandled rejection.
        }
      }
    }

    const sub = AppState.addEventListener('change', (status) => {
      void maybeSync(status);
    });

    return () => sub.remove();
  }, [logout, router, token, user]);
}
