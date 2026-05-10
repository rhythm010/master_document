import { Text, View, useColorScheme } from 'react-native';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? '#121212' : '#ffffff',
      }}
    >
      <Text style={{ color: isDark ? '#ffffff' : '#000000', fontSize: 18 }}>
        Login — Milestone 2
      </Text>
    </View>
  );
}
