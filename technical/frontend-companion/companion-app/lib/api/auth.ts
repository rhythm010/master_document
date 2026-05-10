import { apiClient } from '../api-client';

export interface SessionUser {
  id: string;
  role: 'CLIENT' | 'COMPANION';
  name: string;
  nickname: string;
  email: string;
  emailVerified: boolean;
  biometricAuthEnabled: boolean;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: SessionUser;
}

export function login(email: string, password: string) {
  return apiClient.post<LoginResponse>('/auth/login', { email, password });
}

export function getMe() {
  return apiClient.get<SessionUser>('/users/me');
}

export function resendVerification(email: string) {
  return apiClient.post<{ message: string }>('/auth/resend-verification', { email });
}
