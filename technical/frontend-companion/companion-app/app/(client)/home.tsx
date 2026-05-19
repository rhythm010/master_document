import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSessionStore } from '@/store/session';

/** Client home screen with primary navigation CTAs. */
export default function ClientHomeScreen() {
  const router = useRouter();
  const { logout } = useSessionStore();

  function handleBookCompanions() {
    router.push('/(client)/location');
  }

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Client Home — Milestone 2</Text>

      <Pressable onPress={handleBookCompanions} accessibilityRole="button" style={{ marginTop: 20, padding: 12, backgroundColor: '#000', borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Book companions</Text>
      </Pressable>

      <Pressable onPress={handleLogout} accessibilityRole="button" style={{ marginTop: 20, padding: 12, backgroundColor: '#f00', borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Logout</Text>
      </Pressable>
    </View>
  );
}
