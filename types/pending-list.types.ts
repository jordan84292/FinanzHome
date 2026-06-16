export interface PendingShoppingList {
  list_id: number;
  household_id: number;
  status: string;
  total_amount: number;
  supermarket_id: number;
  supermarket_name: string;
  created_by: number;
  created_by_name: string;
  created_by_lastname: string;
  created_at: string;
  updated_at: string;
  completed_at: string;
  total_items?: number;
  checked_items?: number;
  days_pending?: number;
}

export interface ShoppingListParticipant {
  participant_id: number;
  list_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  percentage: number;
  amount_owed: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface SplitConfig {
  config_id: number;
  household_id: number;
  list_id: number;
  split_type: 'equal' | 'percentage' | 'custom';
  split_data: {
    members: Array<{ user_id: number; percentage: number; first_name?: string; last_name?: string }>;
  };
  include_new_members: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
}

export interface HouseholdMemberForSplit {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface PendingListsState {
  pendingLists: PendingShoppingList[];
  currentList: PendingShoppingList | null;
  currentListParticipants: ShoppingListParticipant[];
  currentListSplitConfig: SplitConfig | null;
  householdMembers: HouseholdMemberForSplit[];
  defaultSplitConfig: SplitConfig | null;
  isLoading: boolean;
  error: string | null;
}

export interface PendingListsActions {
  fetchPendingLists: (householdId: number) => Promise<void>;
  fetchPendingListDetail: (householdId: number, listId: number) => Promise<void>;
  fetchHouseholdMembersForSplit: (householdId: number) => Promise<void>;
  fetchDefaultSplitConfig: (householdId: number) => Promise<void>;
  saveDefaultSplitConfig: (
    householdId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ) => Promise<void>;
  updateListSplitConfig: (
    householdId: number,
    listId: number,
    data: { split_type: string; split_data?: any; members: Array<{ user_id: number; percentage: number }> }
  ) => Promise<void>;
  markParticipantPaid: (householdId: number, listId: number, participantId: number) => Promise<void>;
  setCurrentList: (list: PendingShoppingList | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type PendingListsStore = PendingListsState & PendingListsActions;