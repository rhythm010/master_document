import { usePathname, useRouter, useSegments } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AppApiError } from '@/lib/api-client';
import { login as callLogin, resendVerification } from '@/lib/api/auth';
import { syncAndRoute } from '@/lib/app-state/sync-and-route';
import { useSessionStore } from '@/store/session';
import { InlineError } from '@/components/ui/InlineError';

/** Login form screen. */
export default function LoginScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { login: storeLogin, logout } = useSessionStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);

  /** Submit credentials and route via backend app-state. */
  async function handleLogin() {
    setLoading(true);
    setError(null);
    setUnverifiedEmail(null);
    setResendSuccess(null);

    try {
      const response = await callLogin(email.trim(), password);
      await storeLogin(response.accessToken, response.user);

      await syncAndRoute({
        router,
        pathname,
        segments,
        token: response.accessToken,
        logout,
        roleForFallback: response.user.role,
        fallbackToRoleHomeOnNonAuthError: true,
      });
    } catch (err) {
      if (err instanceof AppApiError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email.trim());
          setError('Please verify your email before logging in.');
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError('Incorrect email or password.');
        } else if (err.code === 'TOO_MANY_ATTEMPTS') {
          setError('Too many login attempts. Please wait 15 minutes and try again.');
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

  async function handleResend() {
    if (!unverifiedEmail) return;
    setLoading(true);
    setResendSuccess(null);
    setError(null);

    try {
      await resendVerification(unverifiedEmail);
      setResendSuccess('Verification email sent. Check your inbox.');
    } catch (err) {
      if (err instanceof AppApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24 }}>Login</Text>

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
      {resendSuccess && (
        <Text style={{ color: 'green', marginBottom: 12 }}>{resendSuccess}</Text>
      )}

      {unverifiedEmail && (
        <Pressable
          onPress={handleResend}
          disabled={loading}
          accessibilityRole="button"
          style={{ marginBottom: 12 }}
        >
          <Text style={{ color: '#0066cc', textDecorationLine: 'underline' }}>
            Resend Verification Email
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={handleLogin}
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
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Log In</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/signup')} accessibilityRole="link">
        <Text style={{ textAlign: 'center', color: '#0066cc' }}>
          Don&apos;t have an account? Sign up
        </Text>
      </Pressable>
    </View>
  );
}
