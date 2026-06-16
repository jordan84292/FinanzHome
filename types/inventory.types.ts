/**
 * Types para el módulo de Inventario - FinanzHome
 */

// ==================== INTERFACES ====================

/**
 * Producto del inventario
 */
export interface Product {
  product_id: number;
  household_id: number;
  category_id: number;
  category_name: string;
  category_icon?: string;
  name: string;
  brand?: string;
  current_quantity: number;
  target_quantity: number;
  min_quantity: number;
  price?: number;
  media_type: 'unit' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml' | 'gal' | 'other';
  supermarket_id?: number | null;
  supermarket_name?: string | null;
  is_active: boolean;
  created_at: string;
  created_by?: number | null;
  stock_status?: 'out_of_stock' | 'low_stock' | 'below_target' | 'ok';
}

/**
 * Categoría de productos
 */
export interface Category {
  category_id: number;
  household_id: number;
  name: string;
  description?: string;
  is_system?: boolean;
  is_active: boolean;
  created_at: string;
}

// ==================== DTOs ====================

/**
 * DTO para crear producto
 */
export interface CreateProductDto {
  name: string;
  brand?: string;
  category_id: number;
  media_type: 'unit' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml' | 'gal' | 'other';
  price?: number;
  target_quantity?: number;
  min_quantity?: number;
  supermarket_id?: number;
  description?: string;
}

/**
 * DTO para actualizar producto
 */
export interface UpdateProductDto {
  name?: string;
  brand?: string;
  category_id?: number;
  media_type?: 'unit' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml' | 'gal' | 'other';
  price?: number;
  target_quantity?: number;
  min_quantity?: number;
  supermarket_id?: number;
  description?: string;
}

/**
 * DTO para actualizar stock
 */
export interface UpdateStockDto {
  quantity_change: number;
  operation: 'add' | 'subtract' | 'set';
}

/**
 * DTO para crear categoría
 */
export interface CreateCategoryDto {
  name: string;
  description?: string;
}

// ==================== RESPONSES ====================

/**
 * Respuesta de lista de productos
 */
export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Respuesta de producto único
 */
export interface ProductResponse {
  product: Product;
}

/**
 * Respuesta de categorías
 */
export interface CategoriesResponse {
  categories: Category[];
}

/**
 * Producto con stock bajo
 */
export interface LowStockProduct extends Product {
  stock_percentage: number;
}

/**
 * Respuesta de productos con stock bajo
 */
export interface LowStockResponse {
  products: LowStockProduct[];
}

/**
 * Sugerencia de compra
 */
export interface ShoppingSuggestion {
  product_id: number;
  product_name: string;
  category_name: string;
  current_quantity: number;
  target_quantity: number;
  suggested_quantity: number;
  media_type: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Respuesta de sugerencias de compra
 */
export interface ShoppingSuggestionsResponse {
  suggestions: ShoppingSuggestion[];
}

// ==================== STORE ====================

/**
 * Estado del store de inventario
 */
export interface InventoryState {
  products: Product[];
  categories: Category[];
  currentProduct: Product | null;
  lowStockProducts: LowStockProduct[];
  shoppingSuggestions: ShoppingSuggestion[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Acciones del store de inventario
 */
export interface InventoryActions {
  // Products
  fetchProducts: (householdId: number, page?: number, limit?: number) => Promise<void>;
  fetchProductById: (householdId: number, productId: number) => Promise<void>;
  createProduct: (householdId: number, data: CreateProductDto) => Promise<void>;
  updateProduct: (householdId: number, productId: number, data: UpdateProductDto) => Promise<void>;
  deleteProduct: (householdId: number, productId: number) => Promise<void>;
  updateStock: (householdId: number, productId: number, data: UpdateStockDto) => Promise<void>;
  
  // Categories
  fetchCategories: (householdId: number) => Promise<void>;
  createCategory: (householdId: number, data: CreateCategoryDto) => Promise<void>;
  updateCategory: (householdId: number, categoryId: number, data: CreateCategoryDto) => Promise<void>;
  deleteCategory: (householdId: number, categoryId: number) => Promise<void>;
  
  // Low Stock & Suggestions
  fetchLowStock: (householdId: number) => Promise<void>;
  fetchShoppingSuggestions: (householdId: number) => Promise<void>;
  fetchPrePurchaseProducts: (householdId: number) => Promise<void>;
  
  // Utilities
  setCurrentProduct: (product: Product | null) => void;
  clearError: () => void;
}

/**
 * Store completo de inventario
 */
export type InventoryStore = InventoryState & InventoryActions;