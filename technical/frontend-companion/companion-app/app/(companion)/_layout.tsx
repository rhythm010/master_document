import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { hasCompletedOnboarding } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

export default function CompanionLayout() {
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
    </Stack>
  );
}
