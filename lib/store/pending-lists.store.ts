import { create } from 'zustand';
import { pendingListsService } from '@/lib/api/pending-lists.service';
import type { PendingListsStore, PendingShoppingList, ShoppingListParticipant, SplitConfig, HouseholdMemberForSplit } from '@/types/pending-list.types';

export const usePendingListsStore = create<PendingListsStore>()((set, get) => ({
  pendingLists: [],
  currentList: null,
  currentListParticipants: [],
  currentListSplitConfig: null,
  householdMembers: [],
  defaultSplitConfig: null,
  isLoading: false,
  error: null,

  fetchPendingLists: async (householdId: number) => {
    try {
      set({ isLoading: true, error: null });
      const response = await pendingListsService.getPendingLists(householdId);
      if (response.success && response.data) {
        set({ pendingLists: response.data.lists || [], isLoading: false });
      } else {
        set({ error: response.message || 'Error al cargar listas pendientes', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Error al cargar listas pendientes', isLoading: false });
    }
  },

  fetchPendingListDetail: async (householdId: number, listId: number) => {
    try {
      set({ isLoading: true, error: null });
      const response = await pendingListsService.getPendingListDetail(householdId, listId);
      if (response.success && response.data) {
        set({
          currentList: response.data.list,
          currentListParticipants: response.data.participants || [],
          isLoading: false,
        });
      } else {
        set({ error: response.message || 'Error al cargar detalle', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Error al cargar detalle', isLoading: false });
    }
  },

  fetchHouseholdMembersForSplit: async (householdId: number) => {
    try {
      const response = await pendingListsService.getHouseholdMembersForSplit(householdId);
      if (response.success && response.data) {
        set({ householdMembers: response.data.members || [] });
      }
    } catch (error: any) {
      console.error('Error fetching members for split:', error);
    }
  },

  fetchDefaultSplitConfig: async (householdId: number) => {
    try {
      const response = await pendingListsService.getHouseholdDefaultSplitConfig(householdId);
      if (response.success && response.data) {
        set({ defaultSplitConfig: response.data });
      }
    } catch (error: any) {
      console.error('Error fetching default split config:', error);
    }
  },

  saveDefaultSplitConfig: async (
    householdId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ) => {
    try {
      set({ isLoading: true, error: null });
      const response = await pendingListsService.saveHouseholdDefaultSplitConfig(householdId, data);
      if (response.success) {
        await get().fetchDefaultSplitConfig(householdId);
        set({ isLoading: false });
      } else {
        set({ error: response.message || 'Error al guardar configuración', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Error al guardar configuración', isLoading: false });
    }
  },

  updateListSplitConfig: async (
    householdId: number,
    listId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ) => {
    try {
      set({ isLoading: true, error: null });
      const response = await pendingListsService.updateListSplitConfig(householdId, listId, data);
      if (response.success) {
        await get().fetchPendingListDetail(householdId, listId);
        set({ isLoading: false });
      } else {
        set({ error: response.message || 'Error al actualizar configuración', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Error al actualizar configuración', isLoading: false });
    }
  },

  markParticipantPaid: async (householdId: number, listId: number, participantId: number) => {
    try {
      const response = await pendingListsService.markParticipantPaid(householdId, listId, participantId);
      if (!response.success) {
        set({ error: response.message || 'Error al marcar como pagado' });
      }
      // Refrescar el detalle para actualizar el estado de pagado
      await get().fetchPendingListDetail(householdId, listId);
    } catch (error: any) {
      set({ error: error.message || 'Error al marcar como pagado' });
    }
  },

  setCurrentList: (list: PendingShoppingList | null) => {
    set({ currentList: list });
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },
}));