import type { AppStateResponse } from '@/lib/api/app-state';

export type ResolvedRoute =
  | '/(auth)/login'
  | '/(client)/onboarding'
  | '/(client)/home'
  | '/(client)/location'
  | '/(client)/matching'
  | '/(client)/in-service'
  | '/(client)/feedback'
  | '/(companion)/onboarding'
  | '/(companion)/home'
  | '/(companion)/matching'
  | '/(companion)/in-service'
  | '/(companion)/feedback';

/** Resolve the target route from backend app-state, with onboarding precedence. */
export function resolveRouteForAppState(
  appState: AppStateResponse,
  params: { onboardingComplete: boolean },
): ResolvedRoute {
  const role = appState.user.role;

  if (!params.onboardingComplete) {
    return role === 'COMPANION'
      ? '/(companion)/onboarding'
      : '/(client)/onboarding';
  }

  if (role === 'CLIENT') {
    switch (appState.nextAction) {
      case 'MATCHING':
        return '/(client)/matching';
      case 'ACTIVE_SESSION':
        return '/(client)/in-service';
      case 'RATING_NEEDED':
        return '/(client)/feedback';
      case 'IDLE':
      case 'COMPANION_INACTIVE':
      default:
        return '/(client)/home';
    }
  }

  // COMPANION
  const isActive = appState.user.companionProfile?.isActive !== false;
  if (!isActive) return '/(companion)/home';

  switch (appState.nextAction) {
    case 'MATCHING':
      return '/(companion)/matching';
    case 'ACTIVE_SESSION':
      return '/(companion)/in-service';
    case 'RATING_NEEDED':
      return '/(companion)/feedback';
    case 'COMPANION_INACTIVE':
    case 'IDLE':
    default:
      return '/(companion)/home';
  }
}
