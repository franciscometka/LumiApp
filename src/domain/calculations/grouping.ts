import type { Transaction } from '../entities/transaction';
import { isExpense, isIncome } from '../entities/transaction';
import type { Money } from '../shared/money';
import { subtractMoney, sumMoney } from '../shared/money';
import type { PlainDate } from '../shared/plain-date';
import { comparePlainDates } from '../shared/plain-date';

/**
 * Agrupamento por dia, com os totais de cada dia ja somados.
 *
 * Fica no dominio e nao no componente por um motivo pratico: somar dinheiro
 * dentro de um `.map()` de JSX e onde essas contas comecam a divergir entre
 * telas. Aqui a soma e testavel e acontece uma vez.
 *
 * A ordem e a de uma extrato: dia mais recente no topo. Dentro do dia, o
 * lancamento criado mais recentemente vem primeiro — assim uma transacao
 * recem-salva aparece onde o olho ja esta, sem precisar procurar.
 */
export interface DayGroup {
  readonly date: PlainDate;
  readonly transactions: readonly Transaction[];
  readonly incomeCents: Money;
  readonly expenseCents: Money;
  /** Entradas menos saidas do dia. Pode ser negativo. */
  readonly netCents: Money;
}

export function groupByDay(transactions: readonly Transaction[]): DayGroup[] {
  const byDate = new Map<PlainDate, Transaction[]>();

  for (const transaction of transactions) {
    const bucket = byDate.get(transaction.date);
    if (bucket === undefined) {
      byDate.set(transaction.date, [transaction]);
    } else {
      bucket.push(transaction);
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => comparePlainDates(b, a))
    .map(([date, items]) => {
      const ordered = [...items].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      );

      const incomeCents = sumMoney(ordered.filter(isIncome).map((item) => item.amountCents));
      const expenseCents = sumMoney(ordered.filter(isExpense).map((item) => item.amountCents));

      return {
        date,
        transactions: ordered,
        incomeCents,
        expenseCents,
        netCents: subtractMoney(incomeCents, expenseCents),
      };
    });
}

/** Quantos lancamentos existem em todos os grupos. Evita recontar na UI. */
export function countInGroups(groups: readonly DayGroup[]): number {
  return groups.reduce((total, group) => total + group.transactions.length, 0);
}
