import type { Money } from '../shared/money';
import { ZERO_MONEY, sumMoney } from '../shared/money';
import type { PlainDate } from '../shared/plain-date';
import { addDays, isBefore, isWithin } from '../shared/plain-date';
import type { Transaction } from '../entities/transaction';
import { sortByDateAsc } from './filters';

/**
 * "Quais contas ainda preciso pagar?"
 *
 * Vencido e vence-em-breve sao separados porque pedem reacoes diferentes:
 * um e problema de hoje, o outro e planejamento da semana.
 */
export interface PendingSummary {
  readonly totalCents: Money;
  readonly count: number;

  readonly overdueCents: Money;
  readonly overdueCount: number;

  readonly dueSoonCents: Money;
  readonly dueSoonCount: number;

  /** Ordenadas por vencimento, da mais proxima para a mais distante. */
  readonly items: readonly Transaction[];
  readonly nextDue: Transaction | null;
}

export const EMPTY_PENDING: PendingSummary = {
  totalCents: ZERO_MONEY,
  count: 0,
  overdueCents: ZERO_MONEY,
  overdueCount: 0,
  dueSoonCents: ZERO_MONEY,
  dueSoonCount: 0,
  items: [],
  nextDue: null,
};

export interface PendingOptions {
  readonly today: PlainDate;
  /** Janela de "vence em breve", em dias a partir de hoje. */
  readonly dueSoonDays?: number;
}

/**
 * Considera apenas saidas pendentes: uma entrada pendente (salario que ainda
 * nao caiu) nao e uma conta a pagar.
 */
export function calculatePending(
  transactions: readonly Transaction[],
  options: PendingOptions,
): PendingSummary {
  const { today, dueSoonDays = 7 } = options;
  const horizon = addDays(today, Math.max(dueSoonDays, 0));

  const items = sortByDateAsc(
    transactions.filter(
      (transaction) => transaction.type === 'expense' && transaction.status === 'pending',
    ),
  );

  const overdueValues: Money[] = [];
  const dueSoonValues: Money[] = [];

  for (const transaction of items) {
    if (isBefore(transaction.date, today)) {
      overdueValues.push(transaction.amountCents);
    } else if (isWithin(transaction.date, today, horizon)) {
      dueSoonValues.push(transaction.amountCents);
    }
  }

  return {
    totalCents: sumMoney(items.map((transaction) => transaction.amountCents)),
    count: items.length,
    overdueCents: sumMoney(overdueValues),
    overdueCount: overdueValues.length,
    dueSoonCents: sumMoney(dueSoonValues),
    dueSoonCount: dueSoonValues.length,
    items,
    nextDue: items[0] ?? null,
  };
}

export function isOverdue(transaction: Transaction, today: PlainDate): boolean {
  return (
    transaction.status === 'pending' &&
    transaction.type === 'expense' &&
    isBefore(transaction.date, today)
  );
}
