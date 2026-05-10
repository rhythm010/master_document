import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { AppApiError } from '@/lib/api-client';
import { resendVerification, verifyEmail } from '@/lib/api/auth';

type VerifyStatus = 'loading' | 'success' | 'expired' | 'invalid' | 'no-token';
type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('no-token');
      return;
    }

    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        if (err instanceof AppApiError && err.code === 'TOKEN_EXPIRED') {
          setStatus('expired');
        } else {
          setStatus('invalid');
        }
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResend() {
    if (!resendEmail.trim()) {
      setResendError('Please enter your email address.');
      return;
    }
    setResendStatus('sending');
    setResendError(null);
    try {
      await resendVerification(resendEmail.trim());
      setResendStatus('sent');
    } catch (err) {
      setResendStatus('error');
      if (err instanceof AppApiError) {
        setResendError(err.message);
      } else {
        setResendError('Something went wrong. Please try again.');
      }
    }
  }

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 16 }}>Verifying your email...</Text>
      </View>
    );
  }

  if (status === 'success') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
          Email verified! You can now log in.
        </Text>
        <Pressable
          onPress={() => router.replace('/(auth)/login')}
          accessibilityRole="button"
          style={{ backgroundColor: '#000', padding: 14, borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  if (status === 'expired') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          This verification link has expired.
        </Text>
        <Text style={{ marginBottom: 16, color: '#555' }}>
          Enter your email address to receive a new verification link.
        </Text>

        <TextInput
          value={resendEmail}
          onChangeText={setResendEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={resendStatus !== 'sending'}
          style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}
        />

        {resendError && (
          <Text style={{ color: 'red', marginBottom: 12 }}>{resendError}</Text>
        )}
        {resendStatus === 'sent' && (
          <Text style={{ color: 'green', marginBottom: 12 }}>
            Verification email sent. Check your inbox.
          </Text>
        )}

        <Pressable
          onPress={handleResend}
          disabled={resendStatus === 'sending'}
          accessibilityRole="button"
          style={{
            backgroundColor: resendStatus === 'sending' ? '#999' : '#000',
            padding: 14,
            borderRadius: 8,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          {resendStatus === 'sending' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Resend Verification Email</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace('/(auth)/login')} accessibilityRole="link">
          <Text style={{ textAlign: 'center', color: '#0066cc' }}>Back to Login</Text>
        </Pressable>
      </View>
    );
  }

  // status === 'invalid' | 'no-token'
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
        Invalid or missing verification link.
      </Text>
      <Pressable
        onPress={() => router.replace('/(auth)/login')}
        accessibilityRole="button"
        style={{ backgroundColor: '#000', padding: 14, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go to Login</Text>
      </Pressable>
    </View>
  );
}
