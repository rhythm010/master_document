import { StyleSheet, Text, View } from 'react-native';
import { useAppStateStore } from '@/store/app-state';

/** Placeholder companion feedback screen (Milestone 3). */
export default function CompanionFeedbackScreen() {
  const { appState } = useAppStateStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Feedback</Text>
      <Text style={styles.body}>
        Rating needed for booking: {appState?.ratingNeeded?.bookingId ?? '(unknown)'}
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
