'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireMembership } from '@/lib/household/require-membership';
import {
  createRecurringExpense,
  deactivateRecurringExpense,
  listOccurrences,
  markOccurrencePaid,
  updateRecurringExpense,
  type ExpenseOccurrenceRecord,
} from '@/lib/db/procedures/recurring-expenses';

const periodicitySchema = z.enum(['weekly', 'biweekly', 'one_time']);

const createRecurringExpenseSchema = z
  .object({
    name: z.string().min(1, 'El nombre es obligatorio').max(150),
    categoryId: z.coerce.number().int().positive(),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    currencyId: z.coerce.number().int().positive(),
    periodicity: periodicitySchema,
    dueDayConfig: z.coerce.number().int().min(1).max(7).optional(),
    withdrawalDay: z.coerce.number().int().min(1).max(31).optional(),
    firstDueDate: z.string().min(1).optional(),
    responsibleMemberId: z.coerce.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    if (data.periodicity === 'weekly' && data.dueDayConfig === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Elegí el día de la semana', path: ['dueDayConfig'] });
    }
    if ((data.periodicity === 'weekly' || data.periodicity === 'biweekly') && data.withdrawalDay === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Elegí el día de retiro', path: ['withdrawalDay'] });
    }
    if (data.periodicity === 'one_time' && !data.firstDueDate) {
      ctx.addIssue({ code: 'custom', message: 'Elegí la fecha de vencimiento', path: ['firstDueDate'] });
    }
  });

export interface CreateRecurringExpenseState {
  error: string | null;
}

export async function createRecurringExpenseAction(
  _prevState: CreateRecurringExpenseState,
  formData: FormData,
): Promise<CreateRecurringExpenseState> {
  const membership = await requireMembership();

  const parsed = createRecurringExpenseSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    currencyId: formData.get('currencyId'),
    periodicity: formData.get('periodicity'),
    dueDayConfig: formData.get('dueDayConfig') || undefined,
    withdrawalDay: formData.get('withdrawalDay') || undefined,
    firstDueDate: formData.get('firstDueDate') || undefined,
    responsibleMemberId: formData.get('responsibleMemberId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await createRecurringExpense({
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      currencyId: parsed.data.currencyId,
      periodicity: parsed.data.periodicity,
      dueDayConfig: parsed.data.periodicity === 'weekly' ? parsed.data.dueDayConfig! : null,
      withdrawalDay: parsed.data.periodicity !== 'one_time' ? parsed.data.withdrawalDay! : null,
      firstDueDate: parsed.data.periodicity === 'one_time' ? parsed.data.firstDueDate! : null,
      responsibleMemberId: parsed.data.responsibleMemberId,
      createdByMemberId: membership.member_id,
    });
  } catch {
    return { error: 'No se pudo guardar el gasto. Verificá los datos e intentá de nuevo.' };
  }

  revalidatePath('/gastos');
  return { error: null };
}

const updateRecurringExpenseSchema = z.object({
  recurringExpenseId: z.coerce.number().int().positive(),
  name: z.string().min(1, 'El nombre es obligatorio').max(150),
  categoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  currencyId: z.coerce.number().int().positive(),
  responsibleMemberId: z.coerce.number().int().positive(),
});

export interface UpdateRecurringExpenseState {
  error: string | null;
}

export async function updateRecurringExpenseAction(
  _prevState: UpdateRecurringExpenseState,
  formData: FormData,
): Promise<UpdateRecurringExpenseState> {
  const membership = await requireMembership();

  const parsed = updateRecurringExpenseSchema.safeParse({
    recurringExpenseId: formData.get('recurringExpenseId'),
    name: formData.get('name'),
    categoryId: formData.get('categoryId'),
    amount: formData.get('amount'),
    currencyId: formData.get('currencyId'),
    responsibleMemberId: formData.get('responsibleMemberId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' };
  }

  try {
    await updateRecurringExpense({
      recurringExpenseId: parsed.data.recurringExpenseId,
      householdId: membership.id,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      currencyId: parsed.data.currencyId,
      responsibleMemberId: parsed.data.responsibleMemberId,
    });
  } catch {
    return { error: 'No se pudo actualizar el gasto. Es posible que ya no exista en tu hogar.' };
  }

  revalidatePath('/gastos');
  return { error: null };
}

export async function deactivateRecurringExpenseAction(recurringExpenseId: number): Promise<void> {
  const membership = await requireMembership();
  await deactivateRecurringExpense(recurringExpenseId, membership.id);
  revalidatePath('/gastos');
}

export interface GetOccurrencesState {
  occurrences: ExpenseOccurrenceRecord[];
  error: string | null;
}

export async function getOccurrencesAction(recurringExpenseId: number): Promise<GetOccurrencesState> {
  const membership = await requireMembership();
  try {
    const occurrences = await listOccurrences(recurringExpenseId, membership.id);
    return { occurrences, error: null };
  } catch {
    return { occurrences: [], error: 'No se pudo cargar el historial de este gasto.' };
  }
}

export interface MarkOccurrencePaidState {
  occurrences: ExpenseOccurrenceRecord[];
  error: string | null;
}

export async function markOccurrencePaidAction(occurrenceId: number): Promise<MarkOccurrencePaidState> {
  const membership = await requireMembership();
  try {
    const occurrences = await markOccurrencePaid({
      occurrenceId,
      householdId: membership.id,
      paidByMemberId: membership.member_id,
    });
    revalidatePath('/gastos');
    return { occurrences, error: null };
  } catch {
    return { occurrences: [], error: 'No se pudo marcar el gasto como pagado.' };
  }
}
