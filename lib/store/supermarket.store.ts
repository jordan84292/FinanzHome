/**
 * Store de Supermercados - Zustand
 * Maneja el estado global de supermercados en FinanzHome
 */

import { create } from 'zustand';
import { supermarketService } from '@/lib/api/supermarket.service';
import type {
  SupermarketStore,
  CreateSupermarketDto,
  UpdateSupermarketDto,
} from '@/types/supermarket.types';

export const useSupermarketStore = create<SupermarketStore>((set, get) => ({
  // ==================== ESTADO INICIAL ====================
  supermarkets: [],
  currentSupermarket: null,
  isLoading: false,
  error: null,

  // ==================== ACTIONS ====================

  /**
   * Obtener todos los supermercados del hogar
   */
  fetchSupermarkets: async (householdId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await supermarketService.getSupermarkets(householdId);

      if (response.success && response.data) {
        set({
          supermarkets: response.data.supermarkets || [],
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar supermercados',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Obtener un supermercado por ID
   */
  fetchSupermarketById: async (householdId: number, supermarketId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await supermarketService.getSupermarketById(householdId, supermarketId);

      if (response.success && response.data) {
        set({
          currentSupermarket: response.data.supermarket,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar supermercado',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Crear un nuevo supermercado
   */
  createSupermarket: async (householdId: number, data: CreateSupermarketDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await supermarketService.createSupermarket(householdId, data);

      if (response.success) {
        // Recargar supermercados después de crear
        await get().fetchSupermarkets(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al crear supermercado',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Actualizar un supermercado
   */
  updateSupermarket: async (
    householdId: number,
    supermarketId: number,
    data: UpdateSupermarketDto,
  ) => {
    try {
      set({ isLoading: true, error: null });

      const response = await supermarketService.updateSupermarket(householdId, supermarketId, data);

      if (response.success) {
        // Recargar supermercados después de actualizar
        await get().fetchSupermarkets(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar supermercado',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Eliminar un supermercado
   */
  deleteSupermarket: async (householdId: number, supermarketId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await supermarketService.deleteSupermarket(householdId, supermarketId);

      if (response.success) {
        // Remover supermercado del estado
        set((state) => ({
          supermarkets: state.supermarkets.filter((s) => s.supermarket_id !== supermarketId),
          isLoading: false,
          error: null,
        }));
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al eliminar supermercado',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Establecer supermercado actual
   */
  setCurrentSupermarket: (supermarket) => {
    set({ currentSupermarket: supermarket });
  },

  /**
   * Limpiar error
   */
  clearError: () => {
    set({ error: null });
  },
}));