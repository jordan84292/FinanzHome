import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
} from '@/lib/db/procedures/household';
import { uniqueSuffix } from '../../helpers/db';

describe('household procedures', () => {
  it('creates a household with its creator as owner', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });

    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: user.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });

    const memberships = await getHouseholdsForUser(user.id);
    expect(memberships).toHaveLength(1);
    expect(memberships[0].id).toBe(household.id);
    expect(memberships[0].role).toBe('owner');
  });

  it('lets an invited user accept an invitation and join the household', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });
    const [ownerMembership] = await getHouseholdsForUser(owner.id);

    const invitee = await registerUser({
      email: `invitee_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Invitee',
    });

    const invitation = await createInvitation({
      householdId: household.id,
      email: invitee.email,
      token: `token_${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    await acceptInvitation({
      token: invitation.token,
      userId: invitee.id,
      displayName: 'Invitee',
      paymentDay: 1,
    });

    const membershipsAfter = await getHouseholdsForUser(invitee.id);
    expect(membershipsAfter).toHaveLength(1);
    expect(membershipsAfter[0].id).toBe(household.id);
    expect(membershipsAfter[0].role).toBe('member');
  });

  it('rejects accepting an invitation twice', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner3_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa ${suffix}`,
      creatorUserId: owner.id,
      creatorDisplayName: 'Owner',
      creatorPaymentDay: 15,
    });
    const [ownerMembership] = await getHouseholdsForUser(owner.id);
    const invitee = await registerUser({
      email: `invitee2_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Invitee',
    });
    const invitation = await createInvitation({
      householdId: household.id,
      email: invitee.email,
      token: `token2_${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });

    await acceptInvitation({
      token: invitation.token,
      userId: invitee.id,
      displayName: 'Invitee',
      paymentDay: 1,
    });

    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: invitee.id,
        displayName: 'Invitee',
        paymentDay: 1,
      }),
    ).rejects.toThrow();
  });
});
