/**
 * Types de Hogares - FinanzHome
 * Tipos TypeScript para el módulo de hogares
 */

// Household (Hogar)
export interface Household {
  id: number;
  name: string;
  description?: string;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  ownerId: number;
  memberCount?: number;
  myRole?: HouseholdRole;
}

// Roles de miembro en el hogar
export type HouseholdRole = 'owner' | 'admin' | 'member' | 'viewer';

// Miembro del hogar
export interface HouseholdMember {
  id: number;
  householdId: number;
  userId: number;
  role: HouseholdRole;
  userName?: string;
  userEmail?: string;
  joinedAt: string;
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

// Usuario activo del sistema que puede ser invitado a un hogar
export interface AvailableUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

// Datos de una invitación pendiente devueltos por
// GET /households/invitations/:invitationId
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

// DTOs para operaciones de hogares
export interface CreateHouseholdDto {
  name: string;
  description?: string;
  currency?: string;
  timezone?: string;
}

export interface UpdateHouseholdDto {
  name?: string;
  description?: string;
  avatar?: string;
  currency?: string;
  timezone?: string;
}

export interface InviteMemberDto {
  email: string;
  role: HouseholdRole;
}

export interface UpdateMemberRoleDto {
  role: HouseholdRole;
}

// Respuestas de la API
export interface HouseholdsResponse {
  success: boolean;
  message: string;
  data: {
    households: Household[];
  };
}

export interface HouseholdResponse {
  success: boolean;
  message: string;
  data: {
    household: Household;
  };
}

export interface HouseholdMembersResponse {
  success: boolean;
  message: string;
  data: {
    members: HouseholdMember[];
  };
}

export interface AvailableUsersResponse {
  success: boolean;
  message: string;
  data: {
    users: AvailableUser[];
  };
}

// Estado del Store de Hogares
export interface HouseholdState {
  households: Household[];
  currentHousehold: Household | null;
  members: HouseholdMember[];
  availableUsers: AvailableUser[];
  pendingInvitationsCount: number;
  isLoading: boolean;
  error: string | null;
}

// Acciones del Store de Hogares
export interface HouseholdActions {
  setHouseholds: (households: Household[]) => void;
  setCurrentHousehold: (household: Household | null) => void;
  setMembers: (members: HouseholdMember[]) => void;
  setAvailableUsers: (users: AvailableUser[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  fetchHouseholds: () => Promise<void>;
  fetchHouseholdById: (householdId: number) => Promise<void>;
  fetchPendingInvitationsCount: () => Promise<void>;
  createHousehold: (data: CreateHouseholdDto) => Promise<Household>;
  updateHousehold: (householdId: number, data: UpdateHouseholdDto) => Promise<void>;
  deleteHousehold: (householdId: number) => Promise<void>;
  fetchMembers: (householdId: number) => Promise<void>;
  fetchAvailableUsers: (householdId: number) => Promise<void>;
  inviteMember: (householdId: number, data: InviteMemberDto) => Promise<void>;
  updateMemberRole: (householdId: number, memberId: number, data: UpdateMemberRoleDto) => Promise<void>;
  removeMember: (householdId: number, memberId: number) => Promise<void>;
  getCurrentHouseholdId: () => number | null;
}

// Store completo de Hogares
export type HouseholdStore = HouseholdState & HouseholdActions;
