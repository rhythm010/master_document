import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useForegroundAppStateRefresh } from '@/hooks/use-foreground-app-state-refresh';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

/** Authenticated companion route group layout (guards role + onboarding and syncs on foreground). */
export default function CompanionLayout() {
  useForegroundAppStateRefresh();

  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (user.role !== 'COMPANION') {
      router.replace('/(client)/home');
      return;
    }

    hasCompletedOnboarding().then((done) => {
      if (!done) router.replace('/(companion)/onboarding');
    });
  }, [router, user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="home" options={{ title: 'Home' }} />
      <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
      <Stack.Screen name="matching" options={{ title: 'Matching' }} />
      <Stack.Screen name="in-service" options={{ title: 'In Service' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
    </Stack>
  );
}
