import { describe, expect, it } from 'vitest';
import { createHouseholdSchema, acceptInvitationSchema } from '@/lib/validation/onboarding';

describe('createHouseholdSchema', () => {
  it('accepts a valid household name and payment day', () => {
    const result = createHouseholdSchema.safeParse({ name: 'Casa García', paymentDay: '15' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentDay).toBe(15);
    }
  });

  it('rejects a payment day outside 1-31', () => {
    const result = createHouseholdSchema.safeParse({ name: 'Casa García', paymentDay: '32' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty household name', () => {
    const result = createHouseholdSchema.safeParse({ name: '', paymentDay: '15' });
    expect(result.success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('accepts a valid token, display name, and payment day', () => {
    const result = acceptInvitationSchema.safeParse({
      token: 'abc123',
      displayName: 'Juan',
      paymentDay: '1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing token', () => {
    const result = acceptInvitationSchema.safeParse({
      token: '',
      displayName: 'Juan',
      paymentDay: '1',
    });
    expect(result.success).toBe(false);
  });
});
