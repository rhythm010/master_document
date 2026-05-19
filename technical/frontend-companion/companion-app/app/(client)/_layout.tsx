import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useForegroundAppStateRefresh } from '@/hooks/use-foreground-app-state-refresh';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

/** Authenticated client route group layout (guards role + onboarding and syncs on foreground). */
export default function ClientLayout() {
  useForegroundAppStateRefresh();

  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else if (user.role !== 'CLIENT') {
      router.replace('/(companion)/home');
      return;
    } else {
      hasCompletedOnboarding().then((done) => {
        if (!done) router.replace('/(client)/onboarding');
      });
    }
  }, [router, user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="onboarding" options={{ title: 'Onboarding', headerShown: false }} />
      <Stack.Screen name="home" options={{ title: 'Home' }} />
      <Stack.Screen name="location" options={{ title: 'Location' }} />
      <Stack.Screen name="booking/calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="booking/time" options={{ title: 'Time' }} />
      <Stack.Screen name="booking/companion-type" options={{ title: 'Companion Type' }} />
      <Stack.Screen name="booking/book-now" options={{ title: 'Book Now' }} />
      <Stack.Screen name="booking/confirmation" options={{ title: 'Confirmation' }} />
      <Stack.Screen name="matching" options={{ title: 'Matching' }} />
      <Stack.Screen name="in-service" options={{ title: 'In Service' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback' }} />
    </Stack>
  );
}
