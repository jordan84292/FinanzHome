import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { inviteHouseholdMember } from '@/lib/household/invite-member';
import { pool } from '@/lib/db/pool';
import { uniqueSuffix } from '../../helpers/db';

describe('inviteHouseholdMember', () => {
  it('creates an invitation row and returns a working invite link to share manually', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
    });
    const [membership] = await getHouseholdsForUser(owner.id);
    const inviteeEmail = `invitee_${suffix}@example.com`;

    const result = await inviteHouseholdMember({
      householdId: household.id,
      email: inviteeEmail,
      invitedByMemberId: membership.member_id,
      appUrl: 'http://localhost:3000',
    });

    expect(result.inviteUrl).toMatch(/^http:\/\/localhost:3000\/onboarding\?invite=[0-9a-f]{48}$/);

    const [rows] = await pool.query(
      'SELECT * FROM household_invitations WHERE household_id = ? AND email = ?',
      [household.id, inviteeEmail],
    );
    expect(rows as unknown[]).toHaveLength(1);
  });
});
