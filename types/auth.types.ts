/**
 * Types de Autenticación - FinanzHome
 * Tipos TypeScript para el sistema de autenticación
 */

// Usuario autenticado
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

// Preferencias de usuario
export interface UserPreferences {
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
  };
  theme: 'light' | 'dark' | 'auto';
}

// DTOs de Autenticación
export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

// Respuestas de Autenticación
export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken?: string; // Opcional, se envía en HttpOnly cookie
  };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// Estado de Autenticación en el Store
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Acciones de Autenticación
export interface AuthActions {
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (credentials: LoginDto) => Promise<void>;
  register: (data: RegisterDto) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (data: ChangePasswordDto) => Promise<void>;
  forgotPassword: (data: ForgotPasswordDto) => Promise<void>;
  resetPassword: (data: ResetPasswordDto) => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

// Store completo de Autenticación
export type AuthStore = AuthState & AuthActions;
