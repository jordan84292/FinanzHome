/**
 * Types para el módulo de Compras - FinanzHome
 */

// ==================== PURCHASE ====================

export interface Purchase {
  purchase_id: number;
  household_id: number;
  supermarket_id: number;
  supermarket_name: string;
  purchase_date: string;
  total_amount: number;
  notes?: string;
  created_at: string;
  created_by: number;
  items_count?: number;
}

export interface PurchaseItem {
  item_id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface PurchaseDetails extends Purchase {
  items: PurchaseItem[];
}

// ==================== SUPERMARKET ====================

export interface Supermarket {
  supermarket_id: number;
  household_id: number;
  name: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

// ==================== PRICE COMPARISON ====================

export interface PriceComparison {
  product_id: number;
  product_name: string;
  supermarket_id: number;
  supermarket_name: string;
  last_price: number;
  purchase_date: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

// ==================== ANALYTICS ====================

export interface SpendingAnalytics {
  period: string;
  supermarket_name: string;
  total_spent: number;
  purchase_count: number;
  avg_purchase: number;
}

// ==================== DTOs ====================

export interface CreatePurchaseDto {
  supermarket_id: number;
  purchase_date: string;
  notes?: string;
  items: CreatePurchaseItemDto[];
}

export interface CreatePurchaseItemDto {
  product_id: number;
  quantity: number;
  unit_price: number;
}

export interface UpdatePurchaseDto {
  supermarket_id?: number;
  purchase_date?: string;
  notes?: string;
}

export interface CreateSupermarketDto {
  name: string;
  location?: string;
}

export interface UpdateSupermarketDto {
  name?: string;
  location?: string;
  is_active?: boolean;
}

// ==================== RESPONSE TYPES ====================

export interface PurchasesResponse {
  purchases: Purchase[];
  total: number;
  page: number;
  limit: number;
}

export interface PurchaseResponse {
  purchase: PurchaseDetails;
}

export interface SupermarketsResponse {
  supermarkets: Supermarket[];
}

export interface PriceComparisonResponse {
  comparisons: PriceComparison[];
}

export interface SpendingAnalyticsResponse {
  analytics: SpendingAnalytics[];
}

// ==================== STORE ====================

export interface PurchaseState {
  purchases: Purchase[];
  currentPurchase: PurchaseDetails | null;
  supermarkets: Supermarket[];
  priceComparisons: PriceComparison[];
  spendingAnalytics: SpendingAnalytics[];
  isLoading: boolean;
  error: string | null;
}

export interface PurchaseActions {
  // Purchases
  fetchPurchases: (householdId: number, page?: number, limit?: number) => Promise<void>;
  fetchPurchaseById: (householdId: number, purchaseId: number) => Promise<void>;
  createPurchase: (householdId: number, data: CreatePurchaseDto) => Promise<void>;
  updatePurchase: (householdId: number, purchaseId: number, data: UpdatePurchaseDto) => Promise<void>;
  deletePurchase: (householdId: number, purchaseId: number) => Promise<void>;

  // Supermarkets
  fetchSupermarkets: (householdId: number) => Promise<void>;
  createSupermarket: (householdId: number, data: CreateSupermarketDto) => Promise<void>;
  updateSupermarket: (householdId: number, supermarketId: number, data: UpdateSupermarketDto) => Promise<void>;
  deleteSupermarket: (householdId: number, supermarketId: number) => Promise<void>;

  // Analytics
  fetchPriceComparison: (householdId: number, productId: number) => Promise<void>;
  fetchSpendingAnalytics: (householdId: number, startDate?: string, endDate?: string) => Promise<void>;

  // Utilities
  setCurrentPurchase: (purchase: PurchaseDetails | null) => void;
  clearError: () => void;
}

export type PurchaseStore = PurchaseState & PurchaseActions;
