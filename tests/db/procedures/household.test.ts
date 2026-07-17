import { describe, expect, it } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import {
  acceptInvitation,
  createHousehold,
  createInvitation,
  getHouseholdsForUser,
  listHouseholdMembers,
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
    });

    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: invitee.id,
        displayName: 'Invitee',
      }),
    ).rejects.toThrow();
  });
});

describe('sp_household_member_list', () => {
  it('lists every member of a household with their display name and role', async () => {
    const suffix = uniqueSuffix();
    const user = await registerUser({
      email: `member_list_owner_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Owner',
    });
    const household = await createHousehold({
      name: `Casa MemberList ${suffix}`,
      creatorUserId: user.id,
      creatorDisplayName: 'Owner',
    });
    const secondUser = await registerUser({
      email: `member_list_second_${suffix}@example.com`,
      passwordHash: 'hash',
      name: 'Second',
    });
    const [ownerMembership] = await getHouseholdsForUser(user.id);
    const invitation = await createInvitation({
      householdId: household.id,
      email: secondUser.email,
      token: `member-list-token-${suffix}`,
      invitedByMemberId: ownerMembership.member_id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await acceptInvitation({ token: invitation.token, userId: secondUser.id, displayName: 'Second' });

    const members = await listHouseholdMembers(household.id);

    expect(members).toHaveLength(2);
    expect(members.map((m) => m.display_name).sort()).toEqual(['Owner', 'Second']);
    expect(members.find((m) => m.display_name === 'Owner')?.role).toBe('owner');
  });

  it('returns an empty array for a household with a bad id', async () => {
    const members = await listHouseholdMembers(999_999_999);
    expect(members).toHaveLength(0);
  });
});
