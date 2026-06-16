/**
 * Store de Inventario - Zustand
 * Maneja el estado global del inventario en FinanzHome
 */

import { create } from 'zustand';
import { inventoryService } from '@/lib/api/inventory.service';
import type {
  InventoryStore,
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  CreateCategoryDto,
} from '@/types/inventory.types';
import type { Product } from '@/types/inventory.types';

export const useInventoryStore = create<InventoryStore>((set, get) => ({
  // ==================== ESTADO INICIAL ====================
  products: [],
  categories: [],
  currentProduct: null,
  lowStockProducts: [],
  shoppingSuggestions: [],
  isLoading: false,
  error: null,

  // ==================== PRODUCTS ====================

  /**
   * Obtener todos los productos del hogar
   */
  fetchProducts: async (householdId: number, page = 1, limit = 50) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.getProducts(householdId, page, limit);

      if (response.success && response.data) {
        set({
          products: response.data.products,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar productos',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Obtener un producto por ID
   */
  fetchProductById: async (householdId: number, productId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.getProductById(householdId, productId);

      if (response.success && response.data) {
        set({
          currentProduct: response.data.product,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar producto',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Crear un nuevo producto
   */
  createProduct: async (householdId: number, data: CreateProductDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.createProduct(householdId, data);

      if (response.success) {
        // Recargar productos después de crear
        await get().fetchProducts(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al crear producto',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Actualizar un producto
   */
  updateProduct: async (
    householdId: number,
    productId: number,
    data: UpdateProductDto,
  ) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.updateProduct(householdId, productId, data);

      if (response.success) {
        // Recargar productos después de actualizar
        await get().fetchProducts(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar producto',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Eliminar un producto
   */
  deleteProduct: async (householdId: number, productId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.deleteProduct(householdId, productId);

      if (response.success) {
        // Remover producto del estado
        set((state) => ({
          products: state.products.filter((p) => p.product_id !== productId),
          isLoading: false,
          error: null,
        }));
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al eliminar producto',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Actualizar stock de un producto
   */
  updateStock: async (
    householdId: number,
    productId: number,
    data: UpdateStockDto,
  ) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.updateStock(householdId, productId, data);

      if (response.success) {
        // Recargar productos después de actualizar stock
        await get().fetchProducts(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar stock',
        isLoading: false,
      });
      throw error;
    }
  },

  // ==================== CATEGORIES ====================

  /**
   * Obtener todas las categorías
   */
  fetchCategories: async (householdId: number) => {
    try {
      const response = await inventoryService.getCategories(householdId);

      if (response.success && response.data) {
        set({
          categories: response.data.categories,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar categorías',
      });
      throw error;
    }
  },

  /**
   * Crear una nueva categoría
   */
  createCategory: async (householdId: number, data: CreateCategoryDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.createCategory(householdId, data);

      if (response.success) {
        // Recargar categorías después de crear
        await get().fetchCategories(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al crear categoría',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Actualizar una categoría
   */
  updateCategory: async (householdId: number, categoryId: number, data: CreateCategoryDto) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.updateCategory(householdId, categoryId, data);

      if (response.success) {
        // Recargar categorías después de actualizar
        await get().fetchCategories(householdId);
        set({ isLoading: false, error: null });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al actualizar categoría',
        isLoading: false,
      });
      throw error;
    }
  },

  /**
   * Eliminar una categoría
   */
  deleteCategory: async (householdId: number, categoryId: number) => {
    try {
      set({ isLoading: true, error: null });

      const response = await inventoryService.deleteCategory(householdId, categoryId);

      if (response.success) {
        // Remover categoría del estado
        set((state) => ({
          categories: state.categories.filter((c) => c.category_id !== categoryId),
          isLoading: false,
          error: null,
        }));
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al eliminar categoría',
        isLoading: false,
      });
      throw error;
    }
  },

  // ==================== LOW STOCK & SUGGESTIONS ====================

  /**
   * Obtener productos con stock bajo
   */
  fetchLowStock: async (householdId: number) => {
    try {
      const response = await inventoryService.getLowStock(householdId);

      if (response.success && response.data) {
        set({
          lowStockProducts: response.data.products,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar stock bajo',
      });
      throw error;
    }
  },

  /**
   * Obtener sugerencias de compra
   */
  fetchShoppingSuggestions: async (householdId: number) => {
    try {
      const response = await inventoryService.getShoppingSuggestions(householdId);

      if (response.success && response.data) {
        set({
          shoppingSuggestions: response.data.suggestions,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar sugerencias',
      });
      throw error;
    }
  },

  /**
   * Obtener productos para registro previo a compra
   */
  fetchPrePurchaseProducts: async (householdId: number) => {
    try {
      set({ isLoading: true, error: null });
      const response = await inventoryService.getPrePurchaseProducts(householdId);

      if (response.success && response.data) {
        set({
          products: response.data.products,
          isLoading: false,
          error: null,
        });
      }
    } catch (error: any) {
      set({
        error: error.message || 'Error al cargar productos para compra',
        isLoading: false,
      });
      throw error;
    }
  },

  // ==================== UTILITIES ====================

  /**
   * Establecer producto actual
   */
  setCurrentProduct: (product) => {
    set({ currentProduct: product });
  },

  /**
   * Limpiar error
   */
  clearError: () => {
    set({ error: null });
  },
}));