import type { Money } from '../shared/money';
import { ZERO_MONEY, subtractMoney, sumMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { Transaction } from '../entities/transaction';

/**
 * Dois saldos, sempre lado a lado e sempre rotulados.
 *
 * - `realizedBalance` conta so o que ja foi pago. E o dinheiro que de fato
 *   passou pela conta.
 * - `projectedBalance` conta tudo, inclusive pendentes. E o que responde
 *   "quanto ainda tenho disponivel" — e por isso o numero de destaque.
 *
 * Expor so um dos dois produz as duas mentiras classicas de app financeiro:
 * parecer rico porque as contas ainda nao venceram, ou parecer pobre porque
 * o salario ainda nao caiu.
 */
export interface PeriodTotals {
  readonly income: Money;
  readonly expense: Money;
  readonly balance: Money;

  readonly paidIncome: Money;
  readonly paidExpense: Money;
  readonly realizedBalance: Money;

  readonly pendingIncome: Money;
  readonly pendingExpense: Money;

  readonly transactionCount: number;
  readonly pendingCount: number;
}

export const EMPTY_TOTALS: PeriodTotals = {
  income: ZERO_MONEY,
  expense: ZERO_MONEY,
  balance: ZERO_MONEY,
  paidIncome: ZERO_MONEY,
  paidExpense: ZERO_MONEY,
  realizedBalance: ZERO_MONEY,
  pendingIncome: ZERO_MONEY,
  pendingExpense: ZERO_MONEY,
  transactionCount: 0,
  pendingCount: 0,
};

/**
 * Soma uma lista ja recortada pelo periodo desejado.
 * Uma lista vazia devolve `EMPTY_TOTALS`, nunca `NaN` nem `undefined`.
 */
export function calculateTotals(transactions: readonly Transaction[]): PeriodTotals {
  const paidIncomeValues: Money[] = [];
  const paidExpenseValues: Money[] = [];
  const pendingIncomeValues: Money[] = [];
  const pendingExpenseValues: Money[] = [];

  for (const transaction of transactions) {
    const isPaidTransaction = transaction.status === 'paid';
    if (transaction.type === 'income') {
      (isPaidTransaction ? paidIncomeValues : pendingIncomeValues).push(transaction.amountCents);
    } else {
      (isPaidTransaction ? paidExpenseValues : pendingExpenseValues).push(transaction.amountCents);
    }
  }

  const paidIncome = sumMoney(paidIncomeValues);
  const paidExpense = sumMoney(paidExpenseValues);
  const pendingIncome = sumMoney(pendingIncomeValues);
  const pendingExpense = sumMoney(pendingExpenseValues);

  const income = sumMoney([paidIncome, pendingIncome]);
  const expense = sumMoney([paidExpense, pendingExpense]);

  return {
    income,
    expense,
    balance: subtractMoney(income, expense),
    paidIncome,
    paidExpense,
    realizedBalance: subtractMoney(paidIncome, paidExpense),
    pendingIncome,
    pendingExpense,
    transactionCount: transactions.length,
    pendingCount: pendingIncomeValues.length + pendingExpenseValues.length,
  };
}

/**
 * Quanto da renda do periodo ja foi comprometido, em %.
 * `null` quando nao ha renda registrada — ver `safePercentage`.
 */
export function incomeUsagePercentage(totals: PeriodTotals): number | null {
  return safePercentage(totals.expense, totals.income);
}

export function hasActivity(totals: PeriodTotals): boolean {
  return totals.transactionCount > 0;
}

export function isNegativeBalance(totals: PeriodTotals): boolean {
  return totals.balance < 0;
}
