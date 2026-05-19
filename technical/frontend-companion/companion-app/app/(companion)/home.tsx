import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAppStateStore } from '@/store/app-state';
import { useSessionStore } from '@/store/session';

/** Companion home screen; shows minimum inactive messaging based on backend-driven app-state. */
export default function CompanionHomeScreen() {
  const router = useRouter();
  const { appState } = useAppStateStore();
  const { logout } = useSessionStore();

  const isInactive =
    appState?.nextAction === 'COMPANION_INACTIVE' ||
    appState?.user.companionProfile?.isActive === false;

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Companion Home — Milestone 2</Text>
      {isInactive ? <Text style={{ marginTop: 12 }}>Companion inactive</Text> : null}
      <Pressable onPress={handleLogout} accessibilityRole="button" style={{ marginTop: 20, padding: 12, backgroundColor: '#f00', borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Logout</Text>
      </Pressable>
    </View>
  );
}
