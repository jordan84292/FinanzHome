import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerUser } from '@/lib/db/procedures/auth';
import { createHousehold, getHouseholdsForUser } from '@/lib/db/procedures/household';
import { inviteHouseholdMember } from '@/lib/household/invite-member';
import { pool } from '@/lib/db/pool';
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

    const result = await inviteHouseholdMember({
      householdId: household.id,
      householdName: household.name,
      email: `invitee_${suffix}@example.com`,
      invitedByMemberId: membership.member_id,
      appUrl: 'http://localhost:3000',
    });

    expect(result).toEqual({ emailSent: true });
    expect(sendInvitationEmailMock).toHaveBeenCalledTimes(1);
    const call = sendInvitationEmailMock.mock.calls[0][0] as { to: string; inviteUrl: string };
    expect(call.to).toBe(`invitee_${suffix}@example.com`);
    expect(call.inviteUrl).toMatch(/^http:\/\/localhost:3000\/onboarding\?invite=[0-9a-f]{48}$/);
  });

  it('still creates the invitation row and resolves with emailSent: false when the email send fails', async () => {
    const suffix = uniqueSuffix();
    const owner = await registerUser({
      email: `owner_fail_${suffix}@example.com`,
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
    const inviteeEmail = `invitee_fail_${suffix}@example.com`;

    sendInvitationEmailMock.mockRejectedValueOnce(new Error('Resend no pudo enviar el correo de invitación: validation_error - API key is invalid'));

    const result = await inviteHouseholdMember({
      householdId: household.id,
      householdName: household.name,
      email: inviteeEmail,
      invitedByMemberId: membership.member_id,
      appUrl: 'http://localhost:3000',
    });

    expect(result).toEqual({ emailSent: false });

    const [rows] = await pool.query(
      'SELECT * FROM household_invitations WHERE household_id = ? AND email = ?',
      [household.id, inviteeEmail],
    );
    expect(rows as unknown[]).toHaveLength(1);
  });
});
