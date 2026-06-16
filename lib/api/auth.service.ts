import apiClient, { ApiResponse, handleApiError } from './config';
import type {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponse,
  LogoutResponse,
  User,
} from '@/types/auth.types';

class AuthService {
  async register(data: RegisterDto): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', data);
      const authData = response.data.data;
      if (!authData) throw new Error('No se recibió datos de autenticación');
      return {
        success: response.data.success,
        message: response.data.message,
        data: authData as { user: User; accessToken: string },
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async login(credentials: LoginDto): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      const authData = response.data.data;
      if (!authData) throw new Error('No se recibió datos de autenticación');
      return {
        success: response.data.success,
        message: response.data.message,
        data: authData as { user: User; accessToken: string },
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post<LogoutResponse>('/auth/logout');
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async logoutAll(): Promise<ApiResponse> {
    try {
      const response = await apiClient.post<LogoutResponse>('/auth/logout-all');
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async refreshToken(): Promise<ApiResponse<{ accessToken: string }>> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/refresh');
      const tokenData = response.data.data;
      if (!tokenData) throw new Error('No se recibió token de actualización');
      return {
        success: response.data.success,
        message: response.data.message,
        data: tokenData as { accessToken: string },
      };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async changePassword(data: ChangePasswordDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/change-password', data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async forgotPassword(data: ForgotPasswordDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/forgot-password', data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async resetPassword(data: ResetPasswordDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/reset-password', data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async getProfile(): Promise<ApiResponse<{ user: User }>> {
    try {
      const response = await apiClient.get<ApiResponse<{ user: User }>>('/users/me');
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }
}

export const authService = new AuthService();
export default authService;