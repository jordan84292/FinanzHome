import { describe, expect, it } from 'vitest';
import { registerSchema } from '@/lib/validation/auth';

describe('registerSchema', () => {
  it('accepts valid registration input', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a-valid-password',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'a-valid-password',
      name: 'Jane Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty name', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'a-valid-password',
      name: '',
    });
    expect(result.success).toBe(false);
  });
});
