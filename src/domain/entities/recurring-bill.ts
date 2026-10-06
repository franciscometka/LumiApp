import { z } from 'zod';

import type { MonthKey, PlainDate } from '../shared/plain-date';
import { getMonthKeyParts, makePlainDateClamped } from '../shared/plain-date';
import {
  dayOfMonthSchema,
  idSchema,
  monthKeySchema,
  positiveMoneySchema,
  shortTextSchema,
  timestampSchema,
} from '../shared/schemas';
import { PAYMENT_METHODS, TRANSACTION_TYPES } from './transaction';

/**
 * Modelo de um lancamento que se repete todo periodo (internet, academia,
 * parcela de emprestimo, assinaturas).
 *
 * `lastGeneratedMonth` e a guarda de idempotencia: a materializacao so cria
 * transacoes para periodos posteriores a ele. Sem isso, cada abertura do app
 * duplicaria as contas do mes.
 */
export const recurringBillSchema = z.object({
  id: idSchema,
  userId: idSchema,
  description: shortTextSchema,
  amountCents: positiveMoneySchema,
  type: z.enum(TRANSACTION_TYPES),
  categoryId: idSchema,
  dueDay: dayOfMonthSchema,
  paymentMethod: z.enum(PAYMENT_METHODS),
  cardId: idSchema.optional(),
  /** Preenchido quando a recorrencia representa a parcela de uma divida. */
  debtId: idSchema.optional(),
  isActive: z.boolean(),
  /** Primeiro mes em que a conta passa a valer. */
  startMonth: monthKeySchema,
  /** Ultimo mes em que a conta vale. Ausente = sem data de termino. */
  endMonth: monthKeySchema.optional(),
  /** Ultimo mes ja materializado. Ausente = nunca gerou nada. */
  lastGeneratedMonth: monthKeySchema.optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.optional(),
});

export type RecurringBill = z.infer<typeof recurringBillSchema>;

/** Se a conta esta vigente naquele mes, ignorando o que ja foi gerado. */
export function isActiveInMonth(bill: RecurringBill, month: MonthKey): boolean {
  if (!bill.isActive || bill.deletedAt !== undefined) return false;
  if (month < bill.startMonth) return false;
  return bill.endMonth === undefined || month <= bill.endMonth;
}

/**
 * Se a conta ainda precisa ser materializada naquele mes.
 * Esta e a condicao que torna a geracao idempotente.
 */
export function needsGeneration(bill: RecurringBill, month: MonthKey): boolean {
  if (!isActiveInMonth(bill, month)) return false;
  return bill.lastGeneratedMonth === undefined || month > bill.lastGeneratedMonth;
}

/**
 * Data de vencimento da conta naquele mes, com o dia limitado ao ultimo dia
 * do mes: "todo dia 31" cai em 28/29 de fevereiro.
 */
export function dueDateInMonth(bill: RecurringBill, month: MonthKey): PlainDate {
  const { year, month: monthNumber } = getMonthKeyParts(month);
  return makePlainDateClamped(year, monthNumber, bill.dueDay);
}
