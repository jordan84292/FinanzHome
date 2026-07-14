import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface CurrencyRecord extends RowDataPacket {
  id: number;
  code: 'CRC' | 'USD';
  name: string;
  symbol: string;
}

export interface ExchangeRateRecord extends RowDataPacket {
  id: number;
  rate_crc_per_usd: number;
  effective_date: string;
  created_by_member_id: number;
  created_at: string;
}

export async function listCurrencies(): Promise<CurrencyRecord[]> {
  return callProcedure<CurrencyRecord>('sp_currency_list');
}

export async function setExchangeRate(params: {
  rateCrcPerUsd: number;
  effectiveDate: string;
  createdByMemberId: number;
}): Promise<ExchangeRateRecord> {
  const rows = await callProcedure<ExchangeRateRecord>('sp_exchange_rate_set', [
    params.rateCrcPerUsd,
    params.effectiveDate,
    params.createdByMemberId,
  ]);
  return rows[0];
}

export async function getLatestExchangeRate(
  asOfDate?: string,
): Promise<ExchangeRateRecord | null> {
  const rows = await callProcedure<ExchangeRateRecord>('sp_exchange_rate_get_latest', [
    asOfDate ?? null,
  ]);
  return rows[0] ?? null;
}

export async function getExchangeRateHistory(limit?: number): Promise<ExchangeRateRecord[]> {
  return callProcedure<ExchangeRateRecord>('sp_exchange_rate_history', [limit ?? null]);
}
