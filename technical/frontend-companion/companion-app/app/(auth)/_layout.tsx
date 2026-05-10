import { Slot, useRouter } from 'expo-router';
import React from 'react';
import { useSessionStore } from '@/store/session';

export default function AuthLayout() {
  const { user, isLoading } = useSessionStore();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === 'COMPANION' ? '/(companion)/home' : '/(client)/home');
    }
  }, [router, user, isLoading]);

  return <Slot />;
}
