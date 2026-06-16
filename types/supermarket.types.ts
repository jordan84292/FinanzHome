/**
 * Types para el módulo de Supermercados - FinanzHome
 */

// ==================== INTERFACES ====================

/**
 * Supermercado
 */
export interface Supermarket {
  supermarket_id: number;
  household_id: number;
  name: string;
  address?: string;
  is_active: boolean;
  created_at: string;
}

// ==================== DTOs ====================

/**
 * DTO para crear supermercado
 */
export interface CreateSupermarketDto {
  name: string;
  address?: string;
}

/**
 * DTO para actualizar supermercado
 */
export interface UpdateSupermarketDto {
  name?: string;
  address?: string;
}

// ==================== RESPONSES ====================

/**
 * Respuesta de lista de supermercados
 */
export interface SupermarketsResponse {
  supermarkets: Supermarket[];
}

/**
 * Respuesta de supermercado único
 */
export interface SupermarketResponse {
  supermarket: Supermarket;
}

// ==================== STORE ====================

/**
 * Estado del store de supermercados
 */
export interface SupermarketState {
  supermarkets: Supermarket[];
  currentSupermarket: Supermarket | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Acciones del store de supermercados
 */
export interface SupermarketActions {
  fetchSupermarkets: (householdId: number) => Promise<void>;
  fetchSupermarketById: (householdId: number, supermarketId: number) => Promise<void>;
  createSupermarket: (householdId: number, data: CreateSupermarketDto) => Promise<void>;
  updateSupermarket: (householdId: number, supermarketId: number, data: UpdateSupermarketDto) => Promise<void>;
  deleteSupermarket: (householdId: number, supermarketId: number) => Promise<void>;
  setCurrentSupermarket: (supermarket: Supermarket | null) => void;
  clearError: () => void;
}

/**
 * Store completo de supermercados
 */
export type SupermarketStore = SupermarketState & SupermarketActions;