/**
 * Store de Compras - Zustand
 * Maneja el estado global de compras en FinanzHome
 */

import { create } from 'zustand';
import { purchaseService } from '@/lib/api/purchase.service';
import type {
  PurchaseStore,
  CreatePurchaseDto,
  UpdatePurchaseDto,
  CreateSupermarketDto,
  UpdateSupermarketDto,
} from '@/types/purchase.types';

export const usePurchaseStore = create<PurchaseStore>((set, get) => ({
  // ==================== ESTADO INICIAL ====================
  purchases: [],
  currentPurchase: null,
  supermarkets: [],
  priceComparisons: [],
  spendingAnalytics: [],
  isLoading: false,
  error: null,

  // ==================== PURCHASES ====================

  fetchPurchases: async (householdId: number, page = 1, limit = 20) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.getPurchases(householdId, page, limit);

      if (response.success && response.data) {
        set({
          purchases: response.data.purchases,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar compras',
        isLoading: false,
      });
      throw error;
    }
  },

  fetchPurchaseById: async (householdId: number, purchaseId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.getPurchaseById(householdId, purchaseId);

      if (response.success && response.data) {
        set({
          currentPurchase: response.data.purchase,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar compra',
        isLoading: false,
      });
      throw error;
    }
  },

  createPurchase: async (householdId: number, data: CreatePurchaseDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.createPurchase(householdId, data);

      if (response.success) {
        await get().fetchPurchases(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al crear compra',
        isLoading: false,
      });
      throw error;
    }
  },

  updatePurchase: async (
    householdId: number,
    purchaseId: number,
    data: UpdatePurchaseDto
  ) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.updatePurchase(householdId, purchaseId, data);

      if (response.success) {
        await get().fetchPurchases(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar compra',
        isLoading: false,
      });
      throw error;
    }
  },

  deletePurchase: async (householdId: number, purchaseId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.deletePurchase(householdId, purchaseId);

      if (response.success) {
        set((state) => ({
          purchases: state.purchases.filter((p) => p.purchase_id !== purchaseId),
          isLoading: false,
          error: null,
        }));
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al eliminar compra',
        isLoading: false,
      });
      throw error;
    }
  },

  // ==================== SUPERMARKETS ====================

  fetchSupermarkets: async (householdId: number) => {
    try {
      const response = await purchaseService.getSupermarkets(householdId);

      if (response.success && response.data) {
        set({
          supermarkets: response.data.supermarkets,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar supermercados',
      });
      throw error;
    }
  },

  createSupermarket: async (householdId: number, data: CreateSupermarketDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.createSupermarket(householdId, data);

      if (response.success) {
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

  updateSupermarket: async (
    householdId: number,
    supermarketId: number,
    data: UpdateSupermarketDto
  ) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.updateSupermarket(
        householdId,
        supermarketId,
        data
      );

      if (response.success) {
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

  deleteSupermarket: async (householdId: number, supermarketId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await purchaseService.deleteSupermarket(householdId, supermarketId);

      if (response.success) {
        set((state) => ({
          supermarkets: state.supermarkets.filter(
            (s) => s.supermarket_id !== supermarketId
          ),
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

  // ==================== ANALYTICS ====================

  fetchPriceComparison: async (householdId: number, productId: number) => {
    try {
      const response = await purchaseService.getPriceComparison(householdId, productId);

      if (response.success && response.data) {
        set({
          priceComparisons: response.data.comparisons,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar comparación de precios',
      });
      throw error;
    }
  },

  fetchSpendingAnalytics: async (
    householdId: number,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      const response = await purchaseService.getSpendingAnalytics(
        householdId,
        startDate,
        endDate
      );

      if (response.success && response.data) {
        set({
          spendingAnalytics: response.data.analytics,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar analítica de gastos',
      });
      throw error;
    }
  },

  // ==================== UTILITIES ====================

  setCurrentPurchase: (purchase) => {
    set({ currentPurchase: purchase });
  },

  clearError: () => {
    set({ error: null });
  },
}));
