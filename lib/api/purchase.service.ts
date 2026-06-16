/**
 * Servicio de API para Compras - FinanzHome
 */

import apiClient from './config';
import { handleApiError } from './config';
import type {
  CreatePurchaseDto,
  UpdatePurchaseDto,
  CreateSupermarketDto,
  UpdateSupermarketDto,
  PurchasesResponse,
  PurchaseResponse,
  SupermarketsResponse,
  PriceComparisonResponse,
  SpendingAnalyticsResponse,
} from '@/types/purchase.types';
import type { ApiResponse } from './config';

class PurchaseService {
  // ==================== PURCHASES ====================

  /**
   * Obtener todas las compras del hogar
   */
  async getPurchases(
    householdId: number,
    page = 1,
    limit = 20
  ): Promise<ApiResponse<PurchasesResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/purchases`,
        { params: { page, limit } }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener detalles de una compra
   */
  async getPurchaseById(
    householdId: number,
    purchaseId: number
  ): Promise<ApiResponse<PurchaseResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/purchases/${purchaseId}`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Crear una nueva compra
   */
  async createPurchase(
    householdId: number,
    data: CreatePurchaseDto
  ): Promise<ApiResponse<{ purchase_id: number }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/purchases`,
        data
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Actualizar una compra
   */
  async updatePurchase(
    householdId: number,
    purchaseId: number,
    data: UpdatePurchaseDto
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.put(
        `/households/${householdId}/purchases/${purchaseId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Eliminar una compra
   */
  async deletePurchase(
    householdId: number,
    purchaseId: number
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(
        `/households/${householdId}/purchases/${purchaseId}`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // ==================== SUPERMARKETS ====================

  /**
   * Obtener todos los supermercados del hogar
   */
  async getSupermarkets(
    householdId: number
  ): Promise<ApiResponse<SupermarketsResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/supermarkets`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Crear un supermercado
   */
  async createSupermarket(
    householdId: number,
    data: CreateSupermarketDto
  ): Promise<ApiResponse<{ supermarket_id: number }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/supermarkets`,
        data
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Actualizar un supermercado
   */
  async updateSupermarket(
    householdId: number,
    supermarketId: number,
    data: UpdateSupermarketDto
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.put(
        `/households/${householdId}/supermarkets/${supermarketId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Eliminar un supermercado
   */
  async deleteSupermarket(
    householdId: number,
    supermarketId: number
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(
        `/households/${householdId}/supermarkets/${supermarketId}`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Obtener comparación de precios de un producto
   */
  async getPriceComparison(
    householdId: number,
    productId: number
  ): Promise<ApiResponse<PriceComparisonResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/purchases/products/${productId}/price-comparison`
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener analítica de gastos
   */
  async getSpendingAnalytics(
    householdId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<SpendingAnalyticsResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/purchases/analytics/spending`,
        { params: { start_date: startDate, end_date: endDate } }
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

export const purchaseService = new PurchaseService();
