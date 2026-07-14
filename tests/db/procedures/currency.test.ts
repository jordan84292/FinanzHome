import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import {
  getExchangeRateHistory,
  getLatestExchangeRate,
  listCurrencies,
  setExchangeRate,
} from '@/lib/db/procedures/currency';
import { uniqueSuffix } from '../../helpers/db';

async function createMember(suffix: string): Promise<number> {
  const user = await registerUser({
    email: `member_${suffix}@example.com`,
    passwordHash: 'hash',
    name: 'Member',
  });
  await createHousehold({
    name: `Casa ${suffix}`,
    creatorUserId: user.id,
    creatorDisplayName: 'Member',
    creatorPaymentDay: 10,
  });
  const [membership] = await getHouseholdsForUser(user.id);
  return membership.member_id;
}

describe('currency procedures', () => {
  it('lists the seeded currencies', async () => {
    const currencies = await listCurrencies();
    const codes = currencies.map((c) => c.code).sort();
    expect(codes).toEqual(['CRC', 'USD']);
  });

  it('rejects a non-positive exchange rate', async () => {
    const memberId = await createMember(uniqueSuffix());
    await expect(
      setExchangeRate({
        rateCrcPerUsd: 0,
        effectiveDate: '2026-07-14',
        createdByMemberId: memberId,
      }),
    ).rejects.toThrow();
  });

  it('returns the most recent rate on or before the requested date', async () => {
    const memberId = await createMember(uniqueSuffix());

    await setExchangeRate({
      rateCrcPerUsd: 520,
      effectiveDate: '2026-07-01',
      createdByMemberId: memberId,
    });
    await setExchangeRate({
      rateCrcPerUsd: 525.5,
      effectiveDate: '2026-07-10',
      createdByMemberId: memberId,
    });

    const latest = await getLatestExchangeRate();
    expect(latest?.rate_crc_per_usd).toBe(525.5);

    const asOfEarlyJuly = await getLatestExchangeRate('2026-07-05');
    expect(asOfEarlyJuly?.rate_crc_per_usd).toBe(520);
  });

  it('keeps a full history ordered by most recent first', async () => {
    const memberId = await createMember(uniqueSuffix());

    await setExchangeRate({
      rateCrcPerUsd: 500,
      effectiveDate: '2026-06-01',
      createdByMemberId: memberId,
    });
    await setExchangeRate({
      rateCrcPerUsd: 510,
      effectiveDate: '2026-06-15',
      createdByMemberId: memberId,
    });

    const history = await getExchangeRateHistory(2);
    expect(history).toHaveLength(2);
    expect(history[0].rate_crc_per_usd).toBeGreaterThanOrEqual(history[1].rate_crc_per_usd);
  });
});
