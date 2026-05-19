import { AppApiError } from '@/lib/api-client';
import { getMyAppState, type AppStateResponse } from '@/lib/api/app-state';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { resolveRouteForAppState } from '@/lib/app-state/resolve-route';
import { useAppStateStore } from '@/store/app-state';

type ReplaceRouter = {
  replace: (href: string) => void;
};

export type SyncAndRouteResult =
  | { kind: 'ok'; appState: AppStateResponse; routedTo: string | null }
  | { kind: 'auth_error' }
  | { kind: 'non_auth_error' };

type InFlightEntry = {
  authBoundary: number;
  tokenKey: string;
  promise: Promise<AppStateResponse>;
};

let authBoundary = 0;
let inFlight: InFlightEntry | null = null;

function isGroupSegment(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function getRouteIdentityFromTarget(target: string): { group: string | null; leafPath: string } {
  const parts = target.split('/').filter(Boolean);
  const group = parts.length > 0 && isGroupSegment(parts[0]) ? parts[0] : null;
  const leafParts = parts.slice(group ? 1 : 0);
  return { group, leafPath: `/${leafParts.join('/')}` };
}

function getRouteIdentityFromSegments(segments: string[]): { group: string | null; leafPath: string } {
  const group = segments.length > 0 && isGroupSegment(segments[0]) ? segments[0] : null;
  const leafParts = segments.slice(group ? 1 : 0);
  return { group, leafPath: `/${leafParts.join('/')}` };
}

function isSameRoute(currentSegments: string[] | undefined, target: string): boolean {
  if (!currentSegments) return false;
  const current = getRouteIdentityFromSegments(currentSegments);
  const desired = getRouteIdentityFromTarget(target);
  return current.group === desired.group && current.leafPath === desired.leafPath;
}

function isAuthError(err: unknown): err is AppApiError {
  return err instanceof AppApiError && (err.status === 401 || err.status === 403);
}

/** Invalidate any cached/in-flight app-state sync across auth boundaries (login/logout/token swap). */
export function invalidateAppStateSyncAndRouteCache(): void {
  authBoundary += 1;
  inFlight = null;
}

/** Fetch app-state, store it, and route to the backend-authoritative next screen (if different). */
export async function syncAndRoute(params: {
  router: ReplaceRouter;
  pathname: string;
  /** Result of `useSegments()` so we can distinguish route groups like (client) vs (companion). */
  segments?: string[];
  /** Access token snapshot for this sync attempt (used to avoid cross-session in-flight reuse). */
  token: string | null;
  logout: () => Promise<void>;
  roleForFallback?: 'CLIENT' | 'COMPANION';
  /** UX-only fallback for login/cold-start; do NOT use on foreground refresh. */
  fallbackToRoleHomeOnNonAuthError?: boolean;
}): Promise<SyncAndRouteResult> {
  const authBoundaryAtStart = authBoundary;
  const tokenKey = params.token ?? '__NO_TOKEN__';

  try {
    const onboardingComplete = await hasCompletedOnboarding();

    if (
      !inFlight ||
      inFlight.authBoundary !== authBoundaryAtStart ||
      inFlight.tokenKey !== tokenKey
    ) {
      const promise = getMyAppState();
      inFlight = { authBoundary: authBoundaryAtStart, tokenKey, promise };
      promise.finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });
    }

    const inFlightPromise = inFlight.promise;
    const appState = await inFlightPromise;

    // If login/logout happened while this request was in-flight, discard the result.
    if (authBoundary !== authBoundaryAtStart) {
      return { kind: 'ok', appState, routedTo: null };
    }

    useAppStateStore.getState().setAppState(appState);

    const target = resolveRouteForAppState(appState, { onboardingComplete });
    const shouldReplace = params.segments
      ? !isSameRoute(params.segments, target)
      : target !== params.pathname;

    if (shouldReplace) {
      params.router.replace(target);
      return { kind: 'ok', appState, routedTo: target };
    }

    return { kind: 'ok', appState, routedTo: null };
  } catch (err) {
    if (isAuthError(err)) {
      // Ensure auth errors never cause an unhandled rejection via a failing logout.
      try {
        await params.logout();
      } catch {
        // ignore
      }

      const loginRoute = '/(auth)/login';
      const shouldReplaceToLogin = params.segments
        ? !isSameRoute(params.segments, loginRoute)
        : params.pathname !== loginRoute;

      if (shouldReplaceToLogin) {
        params.router.replace(loginRoute);
      }

      return { kind: 'auth_error' };
    }

    if (params.fallbackToRoleHomeOnNonAuthError && params.roleForFallback) {
      // UX-only fallback for login/cold-start: preserve onboarding precedence.
      const onboardingComplete = await hasCompletedOnboarding().catch(() => true);
      const fallback = onboardingComplete
        ? params.roleForFallback === 'COMPANION'
          ? '/(companion)/home'
          : '/(client)/home'
        : params.roleForFallback === 'COMPANION'
          ? '/(companion)/onboarding'
          : '/(client)/onboarding';

      const shouldReplaceToFallback = params.segments
        ? !isSameRoute(params.segments, fallback)
        : params.pathname !== fallback;

      if (shouldReplaceToFallback) {
        params.router.replace(fallback);
      }
    }

    return { kind: 'non_auth_error' };
  }
}
