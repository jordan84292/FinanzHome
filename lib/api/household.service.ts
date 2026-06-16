import apiClient, { ApiResponse, handleApiError } from './config';
import type {
  Household,
  CreateHouseholdDto,
  UpdateHouseholdDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  PendingInvitation,
} from '@/types/household.types';

interface HouseholdMembersData {
  members: any[];
}

interface AvailableUsersData {
  users: any[];
}

class HouseholdService {

  // ── Hogares ────────────────────────────────────────────────────────────────

  async getMyHouseholds(): Promise<ApiResponse<{ households: Household[] }>> {
    try {
      const response = await apiClient.get('/households');
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async getHouseholdById(householdId: number): Promise<ApiResponse<{ household: Household }>> {
    try {
      const response = await apiClient.get(`/households/${householdId}`);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async createHousehold(data: CreateHouseholdDto): Promise<ApiResponse<{ household: Household }>> {
    try {
      const response = await apiClient.post('/households', data);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async updateHousehold(householdId: number, data: UpdateHouseholdDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`/households/${householdId}`, data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async deleteHousehold(householdId: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`/households/${householdId}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  // ── Miembros ───────────────────────────────────────────────────────────────

  async getHouseholdMembers(householdId: number): Promise<ApiResponse<HouseholdMembersData>> {
    try {
      const response = await apiClient.get(`/households/${householdId}/members`);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async getAvailableUsers(householdId: number): Promise<ApiResponse<AvailableUsersData>> {
    try {
      const response = await apiClient.get(`/households/${householdId}/available-users`);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async inviteMember(householdId: number, data: InviteMemberDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`/households/${householdId}/members`, data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async removeMember(householdId: number, memberId: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.delete(`/households/${householdId}/members/${memberId}`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async updateMemberRole(householdId: number, memberId: number, data: UpdateMemberRoleDto): Promise<ApiResponse> {
    try {
      const response = await apiClient.put(`/households/${householdId}/members/${memberId}`, data);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  // ── Invitaciones ───────────────────────────────────────────────────────────

  async getInvitation(invitationId: number): Promise<ApiResponse<{ invitation: PendingInvitation }>> {
    try {
      const response = await apiClient.get(`/households/invitations/${invitationId}`);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async acceptInvitation(invitationId: number): Promise<ApiResponse<{ householdId: number; message: string }>> {
    try {
      const response = await apiClient.post(`/households/invitations/${invitationId}/accept`);
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async rejectInvitation(invitationId: number): Promise<ApiResponse> {
    try {
      const response = await apiClient.post(`/households/invitations/${invitationId}/reject`);
      return { success: response.data.success, message: response.data.message };
    } catch (error) {
      throw new Error(handleApiError(error).message);
    }
  }

  async getPendingInvitationsCount(): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await apiClient.get('/households/invitations/pending/count');
      return { success: response.data.success, message: response.data.message, data: response.data.data };
    } catch {
      return { success: false, message: '', data: { count: 0 } };
    }
  }

async getPendingInvitationsList(): Promise<ApiResponse<{ invitations: any[] }>> {
  try {
    const response = await apiClient.get('/households/invitations/pending');
    return { success: response.data.success, message: response.data.message, data: response.data.data };
  } catch {
    return { success: false, message: '', data: { invitations: [] } };
  }
}


}

export const householdService = new HouseholdService();
export default householdService;