import { describe, expect, it } from 'vitest';
import { createHouseholdSchema, acceptInvitationSchema } from '@/lib/validation/onboarding';

describe('createHouseholdSchema', () => {
  it('accepts a valid household name', () => {
    const result = createHouseholdSchema.safeParse({ name: 'Casa García' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty household name', () => {
    const result = createHouseholdSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('acceptInvitationSchema', () => {
  it('accepts a valid token and display name', () => {
    const result = acceptInvitationSchema.safeParse({
      token: 'abc123',
      displayName: 'Juan',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing token', () => {
    const result = acceptInvitationSchema.safeParse({
      token: '',
      displayName: 'Juan',
    });
    expect(result.success).toBe(false);
  });
});
