import type { RowDataPacket } from 'mysql2';
import { callProcedure } from '../call';

export interface HouseholdRecord extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
}

export interface HouseholdInvitationRecord extends RowDataPacket {
  id: number;
  household_id: number;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface HouseholdMemberRecord extends RowDataPacket {
  id: number;
  household_id: number;
  user_id: number;
  display_name: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface HouseholdForUserRecord extends RowDataPacket {
  id: number;
  name: string;
  created_at: string;
  member_id: number;
  display_name: string;
  role: 'owner' | 'member';
}

export async function createHousehold(params: {
  name: string;
  creatorUserId: number;
  creatorDisplayName: string;
}): Promise<HouseholdRecord> {
  const rows = await callProcedure<HouseholdRecord>('sp_household_create', [
    params.name,
    params.creatorUserId,
    params.creatorDisplayName,
  ]);
  return rows[0];
}

export async function createInvitation(params: {
  householdId: number;
  email: string;
  token: string;
  invitedByMemberId: number;
  expiresAt: Date;
}): Promise<HouseholdInvitationRecord> {
  const rows = await callProcedure<HouseholdInvitationRecord>('sp_household_invitation_create', [
    params.householdId,
    params.email,
    params.token,
    params.invitedByMemberId,
    params.expiresAt,
  ]);
  return rows[0];
}

export async function acceptInvitation(params: {
  token: string;
  userId: number;
  displayName: string;
}): Promise<HouseholdMemberRecord> {
  const rows = await callProcedure<HouseholdMemberRecord>('sp_household_invitation_accept', [
    params.token,
    params.userId,
    params.displayName,
  ]);
  return rows[0];
}

export async function getHouseholdsForUser(userId: number): Promise<HouseholdForUserRecord[]> {
  return callProcedure<HouseholdForUserRecord>('sp_household_get_for_user', [userId]);
}
