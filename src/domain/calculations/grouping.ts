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

/**
 * O extrato, separado do que ainda vai acontecer.
 *
 * - `recorded`: dias ate HOJE, inclusive, do mais recente ao mais antigo —
 *   o extrato conta primeiro o que aconteceu.
 * - `upcoming`: dias DEPOIS de hoje, do mais proximo ao mais distante — os
 *   compromissos na ordem em que vao chegar.
 *
 * Antes, a fatura do dia 28 e a academia do dia 31 apareciam no topo da lista
 * do mes atual, acima de "Hoje", porque a ordem era so por data decrescente.
 *
 * A regra e so "comparado a hoje", sem caso especial por mes: num mes
 * encerrado tudo cai em `recorded`; num mes futuro, tudo em `upcoming`, em
 * ordem de chegada.
 */
export interface DayTimeline {
  readonly recorded: readonly DayGroup[];
  readonly upcoming: readonly DayGroup[];
}

export function splitByToday(groups: readonly DayGroup[], today: PlainDate): DayTimeline {
  const recorded = groups
    .filter((group) => group.date <= today)
    .sort((a, b) => comparePlainDates(b.date, a.date));
  const upcoming = groups
    .filter((group) => group.date > today)
    .sort((a, b) => comparePlainDates(a.date, b.date));
  return { recorded, upcoming };
}
