import { Button, StyleSheet, Text, View } from 'react-native';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorScreen({ message, onRetry }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {onRetry && <Button title="Retry" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { textAlign: 'center', marginBottom: 16 },
});
