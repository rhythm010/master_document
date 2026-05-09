import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Onboarding' }} />
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
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
