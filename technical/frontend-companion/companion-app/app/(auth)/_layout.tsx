import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import React from 'react';
import { syncAndRoute } from '@/lib/app-state/sync-and-route';
import { useSessionStore } from '@/store/session';

/** Auth route group layout (login/signup/verify-email). */
export default function AuthLayout() {
  const { user, token, isLoading, logout } = useSessionStore();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();

  React.useEffect(() => {
    if (isLoading || !user) return;

    // If a logged-in user ends up on an auth route, route them via backend app-state.
    void syncAndRoute({
      router,
      pathname,
      segments,
      token,
      logout,
      roleForFallback: user.role,
      fallbackToRoleHomeOnNonAuthError: true,
    }).catch(() => {
      // Do not surface routing sync failures from a background effect.
    });
  }, [isLoading, logout, pathname, router, segments, token, user]);

  return <Slot />;
}
