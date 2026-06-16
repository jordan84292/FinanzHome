import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { householdService } from '@/lib/api/household.service';
import type {
  HouseholdStore,
  CreateHouseholdDto,
  UpdateHouseholdDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  AvailableUser,
} from '@/types/household.types';

/**
 * Store de Hogares - Zustand
 * Maneja el estado global de hogares en FinanzHome
 */

export const useHouseholdStore = create<HouseholdStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
      households: [],
      currentHousehold: null,
      members: [],
      availableUsers: [],
      pendingInvitationsCount: 0,
      isLoading: false,
      error: null,

      // Acciones básicas
      setHouseholds: (households) => {
        set({ households, error: null });
      },

      setCurrentHousehold: (household) => {
        set({ currentHousehold: household, error: null });
      },

      setMembers: (members) => {
        set({ members, error: null });
      },

      setAvailableUsers: (users: AvailableUser[]) => {
        set({ availableUsers: users, error: null });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      /**
       * Get current household ID as a number (handles localStorage string conversion)
       */
      getCurrentHouseholdId: () => {
        const id = get().currentHousehold?.id;
        return id != null ? Number(id) : null;
      },

      /**
       * Carga la cantidad de invitaciones pendientes del usuario.
       * Se llama al iniciar sesión y periódicamente desde el layout.
       */
      fetchPendingInvitationsCount: async () => {
        try {
          const res = await householdService.getPendingInvitationsCount();
          if (res.success && res.data != null) {
            set({ pendingInvitationsCount: res.data.count });
          }
        } catch {
          // No crítico: no afectar el flujo principal
        }
      },

      /**
       * Obtener todos los hogares del usuario
       */
      fetchHouseholds: async () => {
        try {
          set({ isLoading: true, error: null });
          const response = await householdService.getMyHouseholds();

          if (response.success && response.data) {
            const freshHouseholds = response.data.households.filter(
              (h) => h != null && h.id != null, // filtra basura del localStorage
            );
            const currentId = get().currentHousehold?.id;
            const syncedCurrent =
              freshHouseholds.find((h) => h.id === currentId) ??
              freshHouseholds[0] ??
              null;

            set({
              households: freshHouseholds,
              currentHousehold: syncedCurrent,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({ error: error.message || 'Error al cargar hogares', isLoading: false });
          throw error;
        }
      },

      /**
       * Obtener un hogar por ID
       */
      fetchHouseholdById: async (householdId: number) => {
        try {
          set({ isLoading: true, error: null });

          const response = await householdService.getHouseholdById(householdId);

          if (response.success && response.data) {
            set({
              currentHousehold: response.data.household,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Error al cargar hogar',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Crear un nuevo hogar
       */
      createHousehold: async (data: CreateHouseholdDto) => {
        try {
          set({ isLoading: true, error: null });

          const response = await householdService.createHousehold(data);

          if (response.success && response.data) {
            const newHousehold = (response.data as any).household || response.data;

            if (!newHousehold?.id) {
              throw new Error('Respuesta inválida del servidor: hogar sin ID');
            }

            set((state) => ({
              households: [...state.households, newHousehold],
              currentHousehold: newHousehold,
              isLoading: false,
              error: null,
            }));

            return newHousehold;
          }

          throw new Error('Error al crear hogar');
        } catch (error: any) {
          set({
            error: error.message || 'Error al crear hogar',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Actualizar un hogar
       */
      updateHousehold: async (householdId: number, data: UpdateHouseholdDto) => {
        try {
          set({ isLoading: true, error: null });

          await householdService.updateHousehold(householdId, data);

          // Recargar hogares para obtener datos actualizados
          await get().fetchHouseholds();

          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({
            error: error.message || 'Error al actualizar hogar',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Eliminar un hogar
       */
      deleteHousehold: async (householdId: number) => {
        try {
          set({ isLoading: true, error: null });

          await householdService.deleteHousehold(householdId);

          set((state) => {
            const updatedHouseholds = state.households.filter(
              (h) => h.id !== householdId,
            );
            const updatedCurrentHousehold =
              state.currentHousehold?.id === householdId
                ? updatedHouseholds[0] || null
                : state.currentHousehold;

            return {
              households: updatedHouseholds,
              currentHousehold: updatedCurrentHousehold,
              isLoading: false,
              error: null,
            };
          });
        } catch (error: any) {
          set({
            error: error.message || 'Error al eliminar hogar',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Obtener miembros de un hogar
       */
      fetchMembers: async (householdId: number) => {
        try {
          set({ isLoading: true, error: null });

          const response = await householdService.getHouseholdMembers(householdId);

          if (response.success && response.data) {
            // Mapear datos del stored procedure al tipo HouseholdMember
            const mappedMembers = response.data.members.map((m: any) => ({
              id: m.member_id,
              householdId: householdId,
              userId: m.user_id,
              role: m.role,
              userName: `${m.first_name} ${m.last_name}`.trim(),
              userEmail: m.email,
              joinedAt: m.joined_at,
              user: {
                id: m.user_id,
                email: m.email,
                firstName: m.first_name,
                lastName: m.last_name,
              },
            }));

            set({
              members: mappedMembers,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Error al cargar miembros',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Obtener usuarios activos que pueden ser invitados al hogar.
       * Se usa para alimentar el <datalist> del form de invitación.
       */
      fetchAvailableUsers: async (householdId: number) => {
        try {
          const response = await householdService.getAvailableUsers(householdId);

          if (response.success && response.data) {
            set({ availableUsers: response.data.users, error: null });
          } else {
            set({ availableUsers: [] });
          }
        } catch (error: any) {
          // Si falla, no es crítico: el form sigue funcionando manual
          set({ availableUsers: [] });
        }
      },

      /**
       * Invitar un miembro
       */
      inviteMember: async (householdId: number, data: InviteMemberDto) => {
        try {
          set({ isLoading: true, error: null });

          await householdService.inviteMember(householdId, data);

          // Recargar miembros y sugerencias (el invitado ya no debe aparecer)
          await Promise.all([
            get().fetchMembers(householdId),
            get().fetchAvailableUsers(householdId),
          ]);

          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({
            error: error.message || 'Error al invitar miembro',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Actualizar rol de un miembro
       */
      updateMemberRole: async (
        householdId: number,
        memberId: number,
        data: UpdateMemberRoleDto,
      ) => {
        try {
          set({ isLoading: true, error: null });

          await householdService.updateMemberRole(householdId, memberId, data);

          // Recargar miembros
          await get().fetchMembers(householdId);

          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({
            error: error.message || 'Error al actualizar rol',
            isLoading: false,
          });
          throw error;
        }
      },

      /**
       * Eliminar un miembro
       */
      removeMember: async (householdId: number, memberId: number) => {
        try {
          set({ isLoading: true, error: null });

          await householdService.removeMember(householdId, memberId);

          // Recargar miembros y sugerencias (vuelve a estar disponible)
          await Promise.all([
            get().fetchMembers(householdId),
            get().fetchAvailableUsers(householdId),
          ]);

          set({ isLoading: false, error: null });
        } catch (error: any) {
          set({
            error: error.message || 'Error al eliminar miembro',
            isLoading: false,
          });
          throw error;
        }
      },
    }),
    {
      name: 'finanzhome-households',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Solo persistir hogares y hogar actual
        households: state.households,
        currentHousehold: state.currentHousehold,
      }),
    },
  ),
);

export default useHouseholdStore;
