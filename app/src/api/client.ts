import { API_BASE_URL } from '../config';
import type { AuthSession, CreateLoanInput, Loan, LoanStatus, Summary, User } from './types';

/** An error carrying the API's own error code, so screens can react to it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the request never reached the server. */
  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /** Flattens the API's per-field validation details into one message. */
  get fieldErrors(): string[] {
    if (!Array.isArray(this.details)) return [];
    return this.details
      .map((detail) => (typeof detail?.message === 'string' ? detail.message : null))
      .filter((message): message is string => message !== null);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sends `body` as multipart instead of JSON. */
  isFormData?: boolean;
}

let authToken: string | null = null;

/** Keeps the token in one place so callers never pass it per request. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  // Let fetch set the multipart boundary itself.
  if (options.body !== undefined && !options.isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body:
        options.body === undefined
          ? undefined
          : options.isFormData
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Cannot reach the server at ${API_BASE_URL}. Is it running, and on the same network?`,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
      error?.details,
    );
  }

  return payload as T;
}

export const api = {
  requestOtp(phone: string): Promise<{ expiresInSeconds: number; devCode?: string }> {
    return request('/api/auth/request-otp', { method: 'POST', body: { phone } });
  },

  verifyOtp(phone: string, code: string): Promise<AuthSession> {
    return request('/api/auth/verify-otp', { method: 'POST', body: { phone, code } });
  },

  me(): Promise<{ user: User }> {
    return request('/api/auth/me');
  },

  listLoans(status: LoanStatus): Promise<{ loans: Loan[] }> {
    return request(`/api/loans?status=${status}`);
  },

  createLoan(input: CreateLoanInput): Promise<{ loan: Loan }> {
    return request('/api/loans', { method: 'POST', body: input });
  },

  markRepaid(id: string): Promise<{ loan: Loan }> {
    return request(`/api/loans/${id}/repaid`, { method: 'PATCH' });
  },

  deleteLoan(id: string): Promise<void> {
    return request(`/api/loans/${id}`, { method: 'DELETE' });
  },

  summary(): Promise<Summary> {
    return request('/api/summary');
  },

  /**
   * React Native's FormData takes this { uri, name, type } shape rather than a
   * Blob or File — the native layer streams from the file path.
   */
  uploadReceipt(id: string, file: { uri: string; name: string; type: string }): Promise<{ loan: Loan }> {
    const form = new FormData();
    form.append('file', file as unknown as Blob);

    return request(`/api/loans/${id}/receipt`, { method: 'POST', body: form, isFormData: true });
  },
};

export { API_BASE_URL };
