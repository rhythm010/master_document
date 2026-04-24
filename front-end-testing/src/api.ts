/**
 * API Service for backend communication
 * Simple wrapper around axios for testing endpoints
 */

import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './config';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: CONFIG.BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.client.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Auth endpoints
  async signup(data: { name: string; nickname: string; email: string; password: string }) {
    return this.client.post('/auth/signup', data);
  }

  async login(data: { email: string; password: string }) {
    const response = await this.client.post('/auth/login', data);
    // Store token if login successful
    if (response.data?.token) {
      await AsyncStorage.setItem('access_token', response.data.token);
    }
    return response;
  }

  async logout() {
    await AsyncStorage.removeItem('access_token');
  }

  // Venue endpoints
  async getVenues(searchTerm?: string) {
    return this.client.get('/venues', {
      params: searchTerm ? { q: searchTerm } : undefined,
    });
  }

  // Availability endpoint
  async getAvailability(venueId: string, date: string) {
    return this.client.get('/availability', {
      params: { venueId, date },
    });
  }

  // Booking endpoints
  async createBooking(data: { venueId: string; date: string; startTime: string }) {
    return this.client.post('/bookings', data);
  }

  async getBookingDetails(bookingId: string) {
    return this.client.get(`/bookings/${bookingId}/details`);
  }

  async cancelBooking(bookingId: string) {
    return this.client.post(`/bookings/${bookingId}/cancel`);
  }

  // Generic request for testing any endpoint
  async testEndpoint(method: string, endpoint: string, data?: any) {
    const config: any = {
      method: method.toLowerCase(),
      url: endpoint,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.data = data;
    } else if (data && method === 'GET') {
      config.params = data;
    }

    return this.client.request(config);
  }
}

export const api = new ApiService();
