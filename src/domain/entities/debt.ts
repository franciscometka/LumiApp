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
 * Compromisso recorrente com prazo.
 *
 * Apenas `installmentCents` e `dueDay` sao obrigatorios, porque sao o que uma
 * pessoa sempre sabe: quanto paga e quando vence. O prazo (`totalInstallments`,
 * `paidInstallments`, `startDate`) e OPCIONAL de proposito.
 *
 * Modelar a ausencia de informacao e melhor do que fabricar um numero: um
 * "24x, 9 pagas" inventado viraria barra de progresso, previsao de quitacao e
 * saldo devedor — tres mentiras derivadas de um chute. Com os campos
 * opcionais, o app diz honestamente "nao sei" e oferece preencher.
 *
 * Parcelas restantes, totais e progresso continuam SEMPRE derivados; nenhum
 * numero redundante e persistido.
 */
export const debtSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    name: shortTextSchema,
    /** Quanto sai por mes. O unico valor sempre conhecido. */
    installmentCents: positiveMoneySchema,
    /** Total de parcelas. Ausente = prazo desconhecido. */
    totalInstallments: z.number().int().min(1).max(600).optional(),
    /** Parcelas ja pagas. Ausente = desconhecido. */
    paidInstallments: z.number().int().min(0).max(600).optional(),
    dueDay: dayOfMonthSchema,
    /** Data da primeira parcela. Ausente = desconhecida. */
    startDate: plainDateSchema.optional(),
    notes: longTextSchema.optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    deletedAt: timestampSchema.optional(),
  })
  .refine(
    (debt) =>
      debt.totalInstallments === undefined ||
      debt.paidInstallments === undefined ||
      debt.paidInstallments <= debt.totalInstallments,
    {
      message: 'Parcelas pagas não podem exceder o total',
      path: ['paidInstallments'],
    },
  );

export type Debt = z.infer<typeof debtSchema>;

/**
 * Se o prazo e conhecido. Quando falso, todo numero derivado de prazo devolve
 * `null` — a UI mostra "—" ou convida a completar o cadastro.
 */
export function hasSchedule(debt: Debt): debt is Debt & {
  totalInstallments: number;
  paidInstallments: number;
} {
  return debt.totalInstallments !== undefined && debt.paidInstallments !== undefined;
}

export function remainingInstallments(debt: Debt): number | null {
  if (!hasSchedule(debt)) return null;
  return Math.max(debt.totalInstallments - debt.paidInstallments, 0);
}

export function totalAmount(debt: Debt): Money | null {
  if (debt.totalInstallments === undefined) return null;
  return multiplyMoney(debt.installmentCents, debt.totalInstallments);
}

export function paidAmount(debt: Debt): Money | null {
  if (debt.paidInstallments === undefined) return null;
  return multiplyMoney(debt.installmentCents, debt.paidInstallments);
}

export function remainingAmount(debt: Debt): Money | null {
  const remaining = remainingInstallments(debt);
  if (remaining === null) return null;
  return multiplyMoney(debt.installmentCents, remaining);
}

/** Progresso em 0-100. `null` quando o prazo e desconhecido. */
export function progressPercentage(debt: Debt): number | null {
  if (!hasSchedule(debt)) return null;
  return clampPercentage((debt.paidInstallments / debt.totalInstallments) * 100);
}

/**
 * Uma divida so e considerada quitada quando sabemos o prazo E ele acabou.
 * Prazo desconhecido nunca e tratado como quitado — na duvida, o compromisso
 * continua valendo.
 */
export function isSettled(debt: Debt): boolean {
  return remainingInstallments(debt) === 0;
}

/** Mes da ultima parcela. `null` sem data de inicio ou sem total de parcelas. */
export function finalMonth(debt: Debt): MonthKey | null {
  if (debt.startDate === undefined || debt.totalInstallments === undefined) return null;
  return addMonthsToKey(monthKeyOf(debt.startDate), debt.totalInstallments - 1);
}

/**
 * Proxima data de vencimento a partir de uma referencia.
 * Devolve `null` para dividas comprovadamente quitadas.
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
