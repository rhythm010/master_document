import { StyleSheet, Text, View } from 'react-native';
import { useAppStateStore } from '@/store/app-state';

/** Placeholder companion matching screen (Milestone 3). */
export default function CompanionMatchingScreen() {
  const { appState } = useAppStateStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Matching</Text>
      <Text style={styles.body}>
        Booking: {appState?.primaryBooking?.id ?? '(unknown)'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  body: {
    color: '#555',
  },
});
