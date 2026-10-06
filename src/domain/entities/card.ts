import { z } from 'zod';

import type { Money } from '../shared/money';
import { ZERO_MONEY, subtractMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { PlainDate } from '../shared/plain-date';
import {
  addMonths,
  getParts,
  isAfter,
  makePlainDateClamped,
} from '../shared/plain-date';
import {
  dayOfMonthSchema,
  idSchema,
  nonNegativeMoneySchema,
  shortTextSchema,
  timestampSchema,
} from '../shared/schemas';
import { CATEGORY_COLOR_TOKENS } from './category';

/**
 * Na v1 a fatura e um valor informado a mao (`currentInvoiceCents`), igual ao
 * que o usuario le no app do banco. Quando as compras passarem a ser
 * lancadas por cartao, este campo vira um override opcional sobre o valor
 * derivado do ciclo — a forma do dado nao muda.
 */
export const cardSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: shortTextSchema,
  limitCents: nonNegativeMoneySchema,
  /** Dia em que a fatura fecha. */
  closingDay: dayOfMonthSchema,
  /** Dia em que a fatura vence. */
  dueDay: dayOfMonthSchema,
  currentInvoiceCents: nonNegativeMoneySchema,
  /** Quando a fatura foi atualizada pela ultima vez. A UI mostra isso para
   *  que um numero velho nao passe por atual. */
  invoiceUpdatedAt: timestampSchema.optional(),
  colorToken: z.enum(CATEGORY_COLOR_TOKENS),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  archivedAt: timestampSchema.optional(),
  deletedAt: timestampSchema.optional(),
});

export type Card = z.infer<typeof cardSchema>;

/** Quanto ainda resta do limite. Nunca negativo. */
export function availableLimit(card: Card): Money {
  const available = subtractMoney(card.limitCents, card.currentInvoiceCents);
  return available < 0 ? ZERO_MONEY : available;
}

/** Percentual do limite comprometido. `null` quando nao ha limite cadastrado. */
export function limitUsagePercentage(card: Card): number | null {
  return safePercentage(card.currentInvoiceCents, card.limitCents);
}

export function isOverLimit(card: Card): boolean {
  return card.currentInvoiceCents > card.limitCents;
}

/**
 * Proximo vencimento a partir de uma data de referencia.
 * O dia e ajustado ao ultimo dia do mes quando necessario: vencimento dia 31
 * cai em 28/29 de fevereiro, e nao transborda para marco.
 */
export function nextDueDate(card: Card, reference: PlainDate): PlainDate {
  const { year, month } = getParts(reference);
  const thisMonth = makePlainDateClamped(year, month, card.dueDay);
  return isAfter(reference, thisMonth) ? addMonths(thisMonth, 1) : thisMonth;
}

/** Proximo fechamento, com o mesmo tratamento de ultimo dia do mes. */
export function nextClosingDate(card: Card, reference: PlainDate): PlainDate {
  const { year, month } = getParts(reference);
  const thisMonth = makePlainDateClamped(year, month, card.closingDay);
  return isAfter(reference, thisMonth) ? addMonths(thisMonth, 1) : thisMonth;
}
