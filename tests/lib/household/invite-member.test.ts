import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { inviteHouseholdMember } from '@/lib/household/invite-member';
import { uniqueSuffix } from '../../helpers/db';

const sendInvitationEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/email/send-invitation', () => ({
  sendInvitationEmail: (...args: unknown[]) => sendInvitationEmailMock(...args),
}));

describe('inviteHouseholdMember', () => {
  beforeEach(() => {
    sendInvitationEmailMock.mockClear();
  });

  it('creates an invitation row and sends an email with a working invite link', async () => {
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
      creatorPaymentDay: 10,
    });
    const [membership] = await getHouseholdsForUser(owner.id);

    await inviteHouseholdMember({
      householdId: household.id,
      householdName: household.name,
      email: `invitee_${suffix}@example.com`,
      invitedByMemberId: membership.member_id,
      appUrl: 'http://localhost:3000',
    });

    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);
    const call = sendInvitationEmailMock.mock.calls[0][0] as { to: string; inviteUrl: string };
    expect(call.to).toBe(`invitee_${suffix}@example.com`);
    expect(call.inviteUrl).toMatch(/^http:\/\/localhost:3000\/onboarding\?invite=[0-9a-f]{48}$/);
  });
});
