import apiClient from './config';
import type {
  PendingShoppingList,
  ShoppingListParticipant,
  SplitConfig,
  HouseholdMemberForSplit,
} from '@/types/pending-list.types';

class PendingListsService {
  async getPendingLists(householdId: number): Promise<{ success: boolean; data?: { lists: PendingShoppingList[] }; message?: string }> {
    try {
      const response = await apiClient.get(`/households/${householdId}/pending-lists`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener listas pendientes',
      };
    }
  }

  async getPendingListDetail(householdId: number, listId: number): Promise<{
    success: boolean;
    data?: { list: PendingShoppingList; participants: ShoppingListParticipant[] };
    message?: string;
  }> {
    try {
      const response = await apiClient.get(`/households/${householdId}/pending-lists/${listId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener detalle de lista',
      };
    }
  }

  async getListSplitConfig(householdId: number, listId: number): Promise<{ success: boolean; data?: SplitConfig; message?: string }> {
    try {
      const response = await apiClient.get(`/households/${householdId}/pending-lists/${listId}/split-config`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener configuración de reparto',
      };
    }
  }

  async updateListSplitConfig(
    householdId: number,
    listId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/households/${householdId}/pending-lists/${listId}/split-config`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al actualizar configuración de reparto',
      };
    }
  }

  async markParticipantPaid(householdId: number, listId: number, participantId: number): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/households/${householdId}/pending-lists/${listId}/participants/${participantId}/pay`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al marcar como pagado',
      };
    }
  }

  async getHouseholdMembersForSplit(householdId: number): Promise<{
    success: boolean;
    data?: { members: HouseholdMemberForSplit[] };
    message?: string;
  }> {
    try {
      const response = await apiClient.get(`/households/${householdId}/pending-lists/members`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener miembros',
      };
    }
  }

  async getHouseholdDefaultSplitConfig(householdId: number): Promise<{ success: boolean; data?: SplitConfig; message?: string }> {
    try {
      const response = await apiClient.get(`/households/${householdId}/pending-lists/default-split-config`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al obtener configuración por defecto',
      };
    }
  }

  async saveHouseholdDefaultSplitConfig(
    householdId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await apiClient.put(`/households/${householdId}/pending-lists/default-split-config`, data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Error al guardar configuración por defecto',
      };
    }
  }
}

export const pendingListsService = new PendingListsService();