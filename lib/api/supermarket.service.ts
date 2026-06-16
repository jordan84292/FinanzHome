/**
 * Servicio de API para Supermercados - FinanzHome
 */

import apiClient from './config';
import { handleApiError } from './config';
import type {
  CreateSupermarketDto,
  UpdateSupermarketDto,
  SupermarketsResponse,
  SupermarketResponse,
} from '@/types/supermarket.types';
import type { ApiResponse } from './config';

class SupermarketService {
  /**
   * Obtener todos los supermercados del hogar
   */
  async getSupermarkets(householdId: number): Promise<ApiResponse<SupermarketsResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/supermarkets`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Obtener un supermercado por ID
   */
  async getSupermarketById(
    householdId: number,
    supermarketId: number,
  ): Promise<ApiResponse<SupermarketResponse>> {
    try {
      const response = await apiClient.get(
        `/households/${householdId}/supermarkets/${supermarketId}`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Crear un nuevo supermercado
   */
  async createSupermarket(
    householdId: number,
    data: CreateSupermarketDto,
  ): Promise<ApiResponse<{ supermarket_id: number }>> {
    try {
      const response = await apiClient.post(
        `/households/${householdId}/supermarkets`,
        data,
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
    data: UpdateSupermarketDto,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.put(
        `/households/${householdId}/supermarkets/${supermarketId}`,
        data,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }

  /**
   * Eliminar un supermercado (soft delete)
   */
  async deleteSupermarket(
    householdId: number,
    supermarketId: number,
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await apiClient.delete(
        `/households/${householdId}/supermarkets/${supermarketId}`,
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
}

export const supermarketService = new SupermarketService();