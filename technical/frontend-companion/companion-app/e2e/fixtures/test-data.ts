/**
 * Test Data Fixtures
 * Shared mock data and test constants for E2E tests
 */

export const testData = {
  /**
   * Health endpoint responses
   */
  health: {
    healthy: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'local',
    },
    unhealthy: {
      status: 'error',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
    },
  },

  /**
   * App routes and pages
   */
  routes: {
    home: '/',
    onboarding: '/onboarding',
    location: '/location',
    bookingCalendar: '/booking/calendar',
    bookingTime: '/booking/time',
    bookingCompanionType: '/booking/companion-type',
    bookingBookNow: '/booking/book-now',
    bookingConfirmation: '/booking/confirmation',
    matching: '/matching',
    inService: '/in-service',
    feedback: '/feedback',
  },

  /**
   * Page titles and headings
   */
  pages: {
    home: {
      title: 'Companion App - Milestone 0',
      subtitle: /Environment:.*/,
    },
    onboarding: {
      title: 'Onboarding',
    },
    location: {
      title: 'Location',
    },
    booking: {
      calendar: 'Calendar',
      time: 'Time',
      companionType: 'Companion Type',
      bookNow: 'Book Now',
      confirmation: 'Confirmation',
    },
    matching: {
      title: 'Matching',
    },
    inService: {
      title: 'In Service',
    },
    feedback: {
      title: 'Feedback',
    },
  },

  /**
   * UI Elements
   */
  buttons: {
    checkHealth: 'Check Health',
    continue: 'Continue',
    submit: 'Submit',
    cancel: 'Cancel',
    next: 'Next',
    back: 'Back',
  },

  /**
   * Test timeouts (in milliseconds)
   */
  timeouts: {
    short: 1000,
    medium: 3000,
    long: 10000,
    navigation: 5000,
    apiCall: 10000,
  },

  /**
   * Environment variables
   */
  env: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
    environment: process.env.EXPO_PUBLIC_ENV || 'local',
  },

  /**
   * Mock users for testing
   */
  users: {
    client: {
      email: 'client@example.com',
      password: 'test-password-123',
      role: 'CLIENT',
      name: 'Test Client',
    },
    companion: {
      email: 'companion@example.com',
      password: 'test-password-123',
      role: 'COMPANION',
      name: 'Test Companion',
    },
  },

  /**
   * Booking data for testing
   */
  booking: {
    location: {
      address: '123 Main St',
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
    },
    date: '2026-05-20',
    time: '14:00',
    duration: '1 hour',
    companionType: 'Female',
    price: '$50.00',
  },

  /**
   * Network interception patterns
   */
  networkPatterns: {
    health: '**/health',
    booking: '**/bookings/**',
    matching: '**/matching/**',
    session: '**/sessions/**',
  },
};

/**
 * Helper function to get route by name
 */
export function getRoute(name: keyof typeof testData.routes): string {
  return testData.routes[name];
}

/**
 * Helper function to get page title
 */
export function getPageTitle(page: string): string {
  const parts = page.split('.');
  let current: any = testData.pages;
  for (const part of parts) {
    current = current?.[part];
  }
  return current?.title || '';
}

/**
 * Helper to build API URL
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = testData.env.apiUrl;
  return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}
