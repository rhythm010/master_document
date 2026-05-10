import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'onboarding_complete';

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'true');
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(KEY);
  return value === 'true';
}
