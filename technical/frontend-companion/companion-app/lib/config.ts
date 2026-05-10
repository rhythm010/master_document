export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000',
  env: (process.env.EXPO_PUBLIC_ENV ?? 'local') as 'local' | 'staging' | 'production',
};
