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
 * A idempotencia da materializacao NAO mora aqui: ela vem do id determinstico
 * da ocorrencia, em `calculations/materialization`. Ver a nota em
 * `lastGeneratedMonth` sobre por que aquele campo nao serve para isso.
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
  /**
   * LEGADO — nao use para decidir materializacao.
   *
   * Registra o maior mes ja gerado, nao o CONJUNTO dos gerados. Como os meses
   * sao visitados fora de ordem (ver `calculations/materialization`), a regra
   * `month > lastGeneratedMonth` pula meses indevidamente: visitar novembro e
   * depois setembro deixaria setembro sem suas contas para sempre.
   *
   * O campo continua aqui porque remove-lo exigiria migracao, e o schema nao
   * muda neste lote. A idempotencia vem do id determinstico da ocorrencia.
   */
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
 * Data de vencimento da conta naquele mes, com o dia limitado ao ultimo dia
 * do mes: "todo dia 31" cai em 28/29 de fevereiro.
 */
export function dueDateInMonth(bill: RecurringBill, month: MonthKey): PlainDate {
  const { year, month: monthNumber } = getMonthKeyParts(month);
  return makePlainDateClamped(year, monthNumber, bill.dueDay);
}
