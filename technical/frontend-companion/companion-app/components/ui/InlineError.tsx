import { StyleSheet, Text } from 'react-native';

export function InlineError({ message }: { message: string }) {
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: { color: 'red', fontSize: 13, marginTop: 4 },
});
