import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { AppApiError } from '@/lib/api-client';
import { signup } from '@/lib/api/auth';
import { InlineError } from '@/components/ui/InlineError';

export default function SignupScreen() {
  const router = useRouter();

  const [role, setRole] = useState<'CLIENT' | 'COMPANION'>('CLIENT');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup() {
    setLoading(true);
    setError(null);

    try {
      await signup({
        role,
        name: name.trim(),
        nickname: nickname.trim(),
        email: email.trim(),
        password,
        biometricAuthEnabled: false,
      });
      if (Platform.OS === 'web') {
        alert('Account Created! Please check your email to verify your account.');
        router.replace('/(auth)/login');
      } else {
        Alert.alert(
          'Account Created',
          'Please check your email to verify your account.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.code === 'EMAIL_ALREADY_EXISTS') {
          setError('An account with this email already exists.');
        } else if (err.code === 'VALIDATION_ERROR') {
          setError(err.message);
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24 }}>Create Account</Text>

      {/* Role Toggle */}
      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <Pressable
          onPress={() => setRole('CLIENT')}
          accessibilityRole="button"
          style={{
            flex: 1,
            padding: 10,
            alignItems: 'center',
            backgroundColor: role === 'CLIENT' ? '#000' : '#eee',
            borderRadius: 8,
            marginRight: 8,
          }}
        >
          <Text style={{ color: role === 'CLIENT' ? '#fff' : '#000', fontWeight: 'bold' }}>
            Client
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setRole('COMPANION')}
          accessibilityRole="button"
          style={{
            flex: 1,
            padding: 10,
            alignItems: 'center',
            backgroundColor: role === 'COMPANION' ? '#000' : '#eee',
            borderRadius: 8,
          }}
        >
          <Text style={{ color: role === 'COMPANION' ? '#fff' : '#000', fontWeight: 'bold' }}>
            Companion
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Full Name"
        editable={!loading}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        value={nickname}
        onChangeText={setNickname}
        placeholder="Nickname"
        editable={!loading}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        editable={!loading}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
      />

      {error && <InlineError message={error} />}

      <Pressable
        onPress={handleSignup}
        disabled={loading}
        accessibilityRole="button"
        style={{
          backgroundColor: loading ? '#999' : '#000',
          padding: 14,
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Create Account</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/login')} accessibilityRole="link">
        <Text style={{ textAlign: 'center', color: '#0066cc' }}>
          Already have an account? Log in
        </Text>
      </Pressable>
    </View>
  );
}
