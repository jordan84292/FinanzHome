import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { getUserProfile, updatePaymentSchedule } from '@/lib/db/procedures/profile';
import { uniqueSuffix } from '../../helpers/db';

describe('user profile / payment schedule procedures', () => {
  it('returns a profile with no payment schedule set by default', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester',
    });

    const profile = await getUserProfile(user.id);
    expect(profile?.payment_frequency).toBeNull();
    expect(profile?.payment_weekday).toBeNull();
    expect(profile?.payment_day).toBeNull();
  });

  it('sets a weekly schedule and clears payment_day', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 2',
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'weekly',
      paymentWeekday: 5,
      paymentDay: null,
    });

    expect(updated.payment_frequency).toBe('weekly');
    expect(updated.payment_weekday).toBe(5);
    expect(updated.payment_day).toBeNull();
  });

  it('switching to monthly clears a previously-set weekday', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile3_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 3',
    });

    await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'weekly',
      paymentWeekday: 2,
      paymentDay: null,
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'monthly',
      paymentWeekday: null,
      paymentDay: 20,
    });

    expect(updated.payment_frequency).toBe('monthly');
    expect(updated.payment_day).toBe(20);
    expect(updated.payment_weekday).toBeNull();
  });

  it('semimonthly requires neither a weekday nor a day', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile4_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 4',
    });

    const updated = await updatePaymentSchedule({
      userId: user.id,
      paymentFrequency: 'semimonthly',
      paymentWeekday: null,
      paymentDay: null,
    });

    expect(updated.payment_frequency).toBe('semimonthly');
    expect(updated.payment_weekday).toBeNull();
    expect(updated.payment_day).toBeNull();
  });

  it('rejects a weekly schedule with no weekday', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `profile5_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Profile Tester 5',
    });

    await expect(
      updatePaymentSchedule({
        userId: user.id,
        paymentFrequency: 'weekly',
        paymentWeekday: null,
        paymentDay: null,
      }),
    ).rejects.toThrow(/día de la semana/);
  });
});
