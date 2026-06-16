import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authService } from '@/lib/api/auth.service';
import type { AuthStore, LoginDto, RegisterDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from '@/types/auth.types';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      login: async (credentials: LoginDto) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authService.login(credentials);
          if (response.success && response.data) {
            set({
              user: response.data.user,
              accessToken: response.data.accessToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({ error: error.message || 'Error al iniciar sesión', isLoading: false });
          throw error;
        }
      },

      register: async (data: RegisterDto) => {
        try {
          set({ isLoading: true, error: null });
          const response = await authService.register(data);
          if (response.success && response.data) {
            set({
              user: response.data.user,
              accessToken: response.data.accessToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({ error: error.message || 'Error al registrar usuario', isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          set({ isLoading: true, error: null });
          await authService.logout();
          set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, error: null });
          if (typeof window !== 'undefined') window.location.href = '/login';
        } catch (error: any) {
          set({ error: error.message || 'Error al cerrar sesión', isLoading: false });
          throw error;
        }
      },

      logoutAll: async () => {
        try {
          set({ isLoading: true, error: null });
          await authService.logoutAll();
          set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, error: null });
          if (typeof window !== 'undefined') window.location.href = '/login';
        } catch (error: any) {
          set({ error: error.message || 'Error al cerrar sesión', isLoading: false });
          throw error;
        }
      },

      changePassword: async (data: ChangePasswordDto) => {
        try {
          set({ isLoading: true, error: null });
          await authService.changePassword(data);
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message || 'Error al cambiar contraseña', isLoading: false });
          throw error;
        }
      },

      forgotPassword: async (data: ForgotPasswordDto) => {
        try {
          set({ isLoading: true, error: null });
          await authService.forgotPassword(data);
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message || 'Error al solicitar restablecimiento', isLoading: false });
          throw error;
        }
      },

      resetPassword: async (data: ResetPasswordDto) => {
        try {
          set({ isLoading: true, error: null });
          await authService.resetPassword(data);
          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({ error: error.message || 'Error al restablecer contraseña', isLoading: false });
          throw error;
        }
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await authService.getProfile();
          if (response.success && response.data) {
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
          }
        } catch (error: any) {
          set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false, error: null });
        }
      },
    }),
    {
      name: 'finanzhome-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;