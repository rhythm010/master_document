import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSessionStore } from '@/store/session';

export default function CompanionHomeScreen() {
  const router = useRouter();
  const { logout } = useSessionStore();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Companion Home — Milestone 2</Text>
      <Pressable onPress={handleLogout} accessibilityRole="button" style={{ marginTop: 20, padding: 12, backgroundColor: '#f00', borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Logout</Text>
      </Pressable>
    </View>
  );
}
