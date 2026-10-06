import { z } from 'zod';

import type { Money } from '../shared/money';
import { multiplyMoney, sumMoney } from '../shared/money';
import { clampPercentage } from '../shared/percentage';
import type { MonthKey, PlainDate } from '../shared/plain-date';
import {
  addMonths,
  addMonthsToKey,
  getParts,
  isAfter,
  makePlainDateClamped,
  monthKeyOf,
} from '../shared/plain-date';
import {
  dayOfMonthSchema,
  idSchema,
  longTextSchema,
  plainDateSchema,
  positiveMoneySchema,
  shortTextSchema,
  timestampSchema,
} from '../shared/schemas';

/**
 * Parcelas restantes, totais pagos e progresso sao SEMPRE derivados.
 * Guardar numeros redundantes garante que, mais cedo ou mais tarde, dois
 * deles discordem.
 */
export const debtSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    name: shortTextSchema,
    installmentCents: positiveMoneySchema,
    totalInstallments: z.number().int().min(1).max(600),
    paidInstallments: z.number().int().min(0).max(600),
    dueDay: dayOfMonthSchema,
    /** Data da primeira parcela. Define o calendario da divida. */
    startDate: plainDateSchema,
    notes: longTextSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    deletedAt: timestampSchema.optional(),
  })
  .refine((debt) => debt.paidInstallments <= debt.totalInstallments, {
    message: 'Parcelas pagas nao podem exceder o total',
    path: ['paidInstallments'],
  });

export type Debt = z.infer<typeof debtSchema>;

export function remainingInstallments(debt: Debt): number {
  return Math.max(debt.totalInstallments - debt.paidInstallments, 0);
}

export function totalAmount(debt: Debt): Money {
  return multiplyMoney(debt.installmentCents, debt.totalInstallments);
}

export function paidAmount(debt: Debt): Money {
  return multiplyMoney(debt.installmentCents, debt.paidInstallments);
}

export function remainingAmount(debt: Debt): Money {
  return multiplyMoney(debt.installmentCents, remainingInstallments(debt));
}

/** Progresso em 0-100. `totalInstallments` e sempre >= 1 pelo schema. */
export function progressPercentage(debt: Debt): number {
  return clampPercentage((debt.paidInstallments / debt.totalInstallments) * 100);
}

export function isSettled(debt: Debt): boolean {
  return remainingInstallments(debt) === 0;
}

/** Mes em que a ultima parcela vence. */
export function finalMonth(debt: Debt): MonthKey {
  return addMonthsToKey(monthKeyOf(debt.startDate), debt.totalInstallments - 1);
}

/**
 * Proxima data de vencimento a partir de uma referencia.
 * Devolve `null` para dividas ja quitadas.
 */
export function nextDueDate(debt: Debt, reference: PlainDate): PlainDate | null {
  if (isSettled(debt)) return null;
  const { year, month } = getParts(reference);
  const thisMonth = makePlainDateClamped(year, month, debt.dueDay);
  return isAfter(reference, thisMonth) ? addMonths(thisMonth, 1) : thisMonth;
}

/** Soma do que um conjunto de dividas compromete por mes. */
export function monthlyCommitment(debts: readonly Debt[]): Money {
  return sumMoney(debts.filter((debt) => !isSettled(debt)).map((debt) => debt.installmentCents));
}
