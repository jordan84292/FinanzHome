import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Helpers de localStorage ──────────────────────────────────────────────────

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('finanzhome-auth');
    return raw ? JSON.parse(raw)?.state?.accessToken ?? null : null;
  } catch {
    return null;
  }
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('finanzhome-auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state.accessToken = token;
    localStorage.setItem('finanzhome-auth', JSON.stringify(parsed));
  } catch {}
}

function clearStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('finanzhome-auth');
}

// ─── Request interceptor ──────────────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Refresh deduplication ────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

// ─── Response interceptor ─────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Si el refresh mismo falla → limpiar y redirigir
    if (originalRequest.url?.includes('/auth/refresh')) {
      clearStorage();
      if (typeof window !== 'undefined') window.location.replace('/login');
      return Promise.reject(error);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    // Si ya hay un refresh en curso, encolar este request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
        }
        return apiClient(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const refreshResponse = await apiClient.post('/auth/refresh');
      const newToken = refreshResponse.data?.data?.accessToken;

      if (!newToken) throw new Error('No token in refresh response');

      setStoredToken(newToken);
      processQueue(null, newToken);

      if (originalRequest.headers) {
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
      }

      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearStorage();
      if (typeof window !== 'undefined') window.location.replace('/login');
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: any;
}

export const handleApiError = (error: any): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    return {
      message: axiosError.response?.data?.message || axiosError.message || 'Error de conexión',
      statusCode: axiosError.response?.status || 500,
      error: axiosError.response?.data?.error,
      details: axiosError.response?.data?.details,
    };
  }
  return { message: error.message || 'Error desconocido', statusCode: 500 };
};

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}