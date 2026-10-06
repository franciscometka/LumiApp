import type { Money } from '../shared/money';
import { ZERO_MONEY, subtractMoney, sumMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { Transaction } from '../entities/transaction';

/**
 * Dois eixos independentes, e os dois importam.
 *
 * EIXO 1 — pago x pendente
 * - `realizedBalance` conta so o que ja foi pago: o dinheiro que de fato
 *   passou pela conta.
 * - `balance` conta tudo, inclusive pendentes: e o que responde "quanto ainda
 *   tenho disponivel", e por isso o numero de destaque.
 *
 * EIXO 2 — operacional x transferencia
 * - `income` e todo dinheiro que ficou disponivel no periodo, inclusive o que
 *   veio da reserva. No cenario do briefing: R$ 3.100.
 * - `earnedIncome` e so o dinheiro gerado no periodo. No mesmo cenario:
 *   R$ 3.000, porque os R$ 100 da reserva ja eram seus.
 *
 * Misturar os dois eixos produz as mentiras classicas de app financeiro:
 * parecer rico porque as contas ainda nao venceram, parecer pobre porque o
 * salario ainda nao caiu, ou parecer que a renda cresceu quando so se mexeu
 * na poupanca.
 */
export interface PeriodTotals {
  /** Tudo que entrou, inclusive transferencias. O "disponivel". */
  readonly income: Money;
  /** Tudo que saiu, inclusive transferencias. */
  readonly expense: Money;
  /** `income - expense`. O saldo projetado do periodo. */
  readonly balance: Money;

  readonly paidIncome: Money;
  readonly paidExpense: Money;
  readonly realizedBalance: Money;

  readonly pendingIncome: Money;
  readonly pendingExpense: Money;

  /** Dinheiro efetivamente gerado no periodo. Base honesta para "renda". */
  readonly earnedIncome: Money;
  /** Entradas que apenas mudaram de lugar (reserva, outra conta). */
  readonly transferIn: Money;
  /** Saidas que consumiram patrimonio de fato. */
  readonly operationalExpense: Money;
  /** Saidas que apenas mudaram de lugar (guardar uma sobra, por exemplo). */
  readonly transferOut: Money;
  /** `earnedIncome - operationalExpense`. Quanto o mes de fato produziu. */
  readonly operationalBalance: Money;

  readonly transactionCount: number;
  readonly pendingCount: number;
  readonly transferCount: number;
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
  earnedIncome: ZERO_MONEY,
  transferIn: ZERO_MONEY,
  operationalExpense: ZERO_MONEY,
  transferOut: ZERO_MONEY,
  operationalBalance: ZERO_MONEY,
  transactionCount: 0,
  pendingCount: 0,
  transferCount: 0,
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

  const earnedIncomeValues: Money[] = [];
  const transferInValues: Money[] = [];
  const operationalExpenseValues: Money[] = [];
  const transferOutValues: Money[] = [];

  let transferCount = 0;

  for (const transaction of transactions) {
    const isPaidTransaction = transaction.status === 'paid';
    const isTransferTransaction = transaction.flow === 'transfer';
    if (isTransferTransaction) transferCount += 1;

    if (transaction.type === 'income') {
      (isPaidTransaction ? paidIncomeValues : pendingIncomeValues).push(transaction.amountCents);
      (isTransferTransaction ? transferInValues : earnedIncomeValues).push(transaction.amountCents);
    } else {
      (isPaidTransaction ? paidExpenseValues : pendingExpenseValues).push(transaction.amountCents);
      (isTransferTransaction ? transferOutValues : operationalExpenseValues).push(
        transaction.amountCents,
      );
    }
  }

  const paidIncome = sumMoney(paidIncomeValues);
  const paidExpense = sumMoney(paidExpenseValues);
  const pendingIncome = sumMoney(pendingIncomeValues);
  const pendingExpense = sumMoney(pendingExpenseValues);

  const income = sumMoney([paidIncome, pendingIncome]);
  const expense = sumMoney([paidExpense, pendingExpense]);

  const earnedIncome = sumMoney(earnedIncomeValues);
  const transferIn = sumMoney(transferInValues);
  const operationalExpense = sumMoney(operationalExpenseValues);
  const transferOut = sumMoney(transferOutValues);

  return {
    income,
    expense,
    balance: subtractMoney(income, expense),

    paidIncome,
    paidExpense,
    realizedBalance: subtractMoney(paidIncome, paidExpense),

    pendingIncome,
    pendingExpense,

    earnedIncome,
    transferIn,
    operationalExpense,
    transferOut,
    operationalBalance: subtractMoney(earnedIncome, operationalExpense),

    transactionCount: transactions.length,
    pendingCount: pendingIncomeValues.length + pendingExpenseValues.length,
    transferCount,
  };
}

/**
 * Quanto do dinheiro DISPONIVEL ja foi comprometido, em %.
 * Usa `income` (inclui reserva) porque a pergunta e sobre o caixa do mes.
 * `null` quando nao ha entrada registrada — ver `safePercentage`.
 */
export function incomeUsagePercentage(totals: PeriodTotals): number | null {
  return safePercentage(totals.expense, totals.income);
}

/**
 * Quanto da RENDA GERADA ja foi comprometido, em %.
 * Ignora reserva e transferencias dos dois lados: e a leitura certa para
 * julgar se o mes se sustenta sozinho.
 */
export function earnedIncomeUsagePercentage(totals: PeriodTotals): number | null {
  return safePercentage(totals.operationalExpense, totals.earnedIncome);
}

/** Se o periodo depende de reserva ou de outra conta para fechar. */
export function dependsOnTransfers(totals: PeriodTotals): boolean {
  return totals.transferIn > 0;
}

export function hasActivity(totals: PeriodTotals): boolean {
  return totals.transactionCount > 0;
}

export function isNegativeBalance(totals: PeriodTotals): boolean {
  return totals.balance < 0;
}
