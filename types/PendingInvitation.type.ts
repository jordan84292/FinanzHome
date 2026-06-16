// ─── Agregar esta interfaz a frontend/types/household.types.ts ───────────────

/**
 * Datos de una invitación pendiente devueltos por
 * GET /households/invitations/:invitationId
 */
export interface PendingInvitation {
  invitation_id: number;
  household_id: number;
  household_name: string;
  household_description?: string;
  proposed_role: 'admin' | 'member';
  status: 'pending';
  expires_at: string;
  inviter_id: number;
  inviter_name: string;
  inviter_email: string;
}
