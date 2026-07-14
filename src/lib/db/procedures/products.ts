import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface ProductCategoryRecord extends RowDataPacket {
  id: number;
  name: string;
}

export interface UnitOfMeasureRecord extends RowDataPacket {
  id: number;
  code: string;
  name: string;
}

export async function listCategories(): Promise<ProductCategoryRecord[]> {
  return callProcedure<ProductCategoryRecord>('sp_category_list');
}

export async function createCategory(name: string): Promise<ProductCategoryRecord> {
  const rows = await callProcedure<ProductCategoryRecord>('sp_category_create', [name]);
  return rows[0];
}

export async function listUnits(): Promise<UnitOfMeasureRecord[]> {
  return callProcedure<UnitOfMeasureRecord>('sp_unit_list');
}

export interface ProductRecord extends RowDataPacket {
  id: number;
  household_id: number;
  name: string;
  category_id: number;
  category_name: string;
  unit_id: number;
  unit_code: string;
  unit_name: string;
  optimal_quantity: number;
  current_quantity: number;
  default_price: number | null;
  default_price_currency_id: number | null;
  is_active: number;
  created_by_member_id: number;
  created_at: string;
}

export async function listProducts(householdId: number): Promise<ProductRecord[]> {
  return callProcedure<ProductRecord>('sp_product_list', [householdId]);
}

export async function createProduct(params: {
  householdId: number;
  name: string;
  categoryId: number;
  unitId: number;
  optimalQuantity: number;
  currentQuantity: number;
  defaultPrice: number | null;
  defaultPriceCurrencyId: number | null;
  createdByMemberId: number;
}): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_create', [
    params.householdId,
    params.name,
    params.categoryId,
    params.unitId,
    params.optimalQuantity,
    params.currentQuantity,
    params.defaultPrice,
    params.defaultPriceCurrencyId,
    params.createdByMemberId,
  ]);
  return rows[0];
}

export async function updateProduct(params: {
  productId: number;
  name: string;
  categoryId: number;
  unitId: number;
  optimalQuantity: number;
  defaultPrice: number | null;
  defaultPriceCurrencyId: number | null;
}): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_update', [
    params.productId,
    params.name,
    params.categoryId,
    params.unitId,
    params.optimalQuantity,
    params.defaultPrice,
    params.defaultPriceCurrencyId,
  ]);
  return rows[0];
}

export async function updateCurrentQuantity(
  productId: number,
  currentQuantity: number,
): Promise<ProductRecord> {
  const rows = await callProcedure<ProductRecord>('sp_product_update_current_quantity', [
    productId,
    currentQuantity,
  ]);
  return rows[0];
}

export async function deactivateProduct(productId: number): Promise<void> {
  await callProcedure('sp_product_deactivate', [productId]);
}
