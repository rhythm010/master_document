import { usePathname, useRouter, useSegments } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { syncAndRoute } from '@/lib/app-state/sync-and-route';
import { markOnboardingComplete } from '@/lib/onboarding-storage';
import { useSessionStore } from '@/store/session';

const SLIDES = [
  {
    title: 'Welcome to Companion',
    body: 'Your trusted companion experience starts here.',
  },
  {
    title: 'Find Your Companion',
    body: 'Browse and book companions that match your needs and schedule.',
  },
  {
    title: 'Ready to Begin',
    body: 'Your first session is just a few taps away.',
  },
];

/** Minimal client onboarding slides (local storage). */
export default function ClientOnboardingScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const { user, token, logout } = useSessionStore();
  const [currentSlide, setCurrentSlide] = useState(0);

  function handleBack() {
    setCurrentSlide((prev) => prev - 1);
  }

  /** Advance slides; on completion, sync app-state and route accordingly. */
  async function handleNext() {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
      return;
    }

    await markOnboardingComplete();

    await syncAndRoute({
      router,
      pathname,
      segments,
      token,
      logout,
      roleForFallback: user?.role,
      fallbackToRoleHomeOnNonAuthError: true,
    });
  }

  return (
    <View style={{ flex: 1, padding: 24 }}>
      {/* Image placeholder */}
      <View style={{ height: 200, backgroundColor: '#E0E0E0', borderRadius: 12, marginBottom: 24 }} />

      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>
        {SLIDES[currentSlide].title}
      </Text>
      <Text style={{ fontSize: 16, color: '#555', marginBottom: 24 }}>
        {SLIDES[currentSlide].body}
      </Text>

      <Text style={{ textAlign: 'center', color: '#999', marginBottom: 24 }}>
        {currentSlide + 1} / {SLIDES.length}
      </Text>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {currentSlide > 0 && (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            style={{ padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', flex: 1, marginRight: 8, alignItems: 'center' }}
          >
            <Text>Back</Text>
          </Pressable>
        )}
        <Pressable
          onPress={handleNext}
          accessibilityRole="button"
          style={{ backgroundColor: '#000', padding: 14, borderRadius: 8, flex: 1, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
