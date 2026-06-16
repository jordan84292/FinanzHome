/**
 * Servicio de API para Inventario - FinanzHome
 */

import apiClient from './config';
import { handleApiError } from './config';
import type {
  CreateProductDto,
  UpdateProductDto,
  UpdateStockDto,
  CreateCategoryDto,
  ProductsResponse,
  ProductResponse,
  CategoriesResponse,
  LowStockResponse,
  ShoppingSuggestionsResponse,
} from '@/types/inventory.types';
import type { Product } from '@/types/inventory.types';
import type { ApiResponse } from './config';

class InventoryService {
  // ==================== PRODUCTS ====================

  /**
   * Obtener todos los productos del hogar
   */
  async getProducts(
    householdId: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<ApiResponse<ProductsResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/inventory/products`,
        { params: { page, limit } },
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener un producto por ID
   */
  async getProductById(
    householdId: number,
    productId: number,
  ): Promise<ApiResponse<ProductResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/inventory/products/${productId}`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Crear un nuevo producto
   */
  async createProduct(
    householdId: number,
    data: CreateProductDto,
  ): Promise<ApiResponse<{ product_id: number }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/inventory/products`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Actualizar un producto
   */
  async updateProduct(
    householdId: number,
    productId: number,
    data: UpdateProductDto,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.put(
        `/households/${householdId}/inventory/products/${productId}`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Eliminar un producto (soft delete)
   */
  async deleteProduct(
    householdId: number,
    productId: number,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(
        `/households/${householdId}/inventory/products/${productId}`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Actualizar stock de un producto
   */
  async updateStock(
    householdId: number,
    productId: number,
    data: UpdateStockDto,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/inventory/products/${productId}/stock`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // ==================== CATEGORIES ====================

  /**
   * Obtener todas las categorías del hogar
   */
  async getCategories(householdId: number): Promise<ApiResponse<CategoriesResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/categories`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Crear una nueva categoría
   */
  async createCategory(
    householdId: number,
    data: CreateCategoryDto,
  ): Promise<ApiResponse<{ category_id: number }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/categories`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Actualizar una categoría
   */
  async updateCategory(
    householdId: number,
    categoryId: number,
    data: CreateCategoryDto,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.put(
        `/households/${householdId}/categories/${categoryId}`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Eliminar una categoría (soft delete)
   */
  async deleteCategory(
    householdId: number,
    categoryId: number,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(
        `/households/${householdId}/categories/${categoryId}`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // ==================== LOW STOCK & SUGGESTIONS ====================

  /**
   * Obtener productos con stock bajo
   */
  async getLowStock(householdId: number): Promise<ApiResponse<LowStockResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/inventory/low-stock`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener sugerencias de compra
   */
  async getShoppingSuggestions(
    householdId: number,
  ): Promise<ApiResponse<ShoppingSuggestionsResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/inventory/shopping-suggestions`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener productos para registro previo a compra
   */
  async getPrePurchaseProducts(
    householdId: number,
  ): Promise<ApiResponse<{ products: Product[] }>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/inventory/pre-purchase`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

export const inventoryService = new InventoryService();