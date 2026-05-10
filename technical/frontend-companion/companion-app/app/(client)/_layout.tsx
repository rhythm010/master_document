import { Stack, useRouter } from 'expo-router';
import React from 'react';
import { useSessionStore } from '@/store/session';

export default function ClientLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else if (user.role !== 'CLIENT') {
      router.replace('/(companion)/home');
    }
  }, [router, user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <Stack screenOptions={{ headerShown: true }}>
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
