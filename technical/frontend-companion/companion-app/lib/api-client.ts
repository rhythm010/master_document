import { config } from './config';

const TIMEOUT_MS = 10_000;

export class AppApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AppApiError';
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const res = await fetch(`${config.apiBaseUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(id);

      if (!res.ok) {
        const err = await res.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: `HTTP ${res.status}`,
        }));
        throw new AppApiError(err.code, err.message, res.status);
      }

      return res.json() as Promise<T>;
    } catch (err) {
      clearTimeout(id);
      if ((err as Error).name === 'AbortError') {
        throw new AppApiError('REQUEST_TIMEOUT', 'Request timed out', 0);
      }
      throw err;
    }
  }

  get<T>(path: string) { return this.request<T>('GET', path); }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>('PATCH', path, body); }
  delete<T>(path: string) { return this.request<T>('DELETE', path); }
}

export const apiClient = new ApiClient();
