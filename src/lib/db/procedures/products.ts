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
