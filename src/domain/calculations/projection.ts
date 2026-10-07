import type { Transaction } from '../entities/transaction';
import type { Money } from '../shared/money';
import {
  ZERO_MONEY,
  addMoney,
  clampMoneyToZero,
  divideMoney,
  multiplyMoney,
  subtractMoney,
  sumMoney,
} from '../shared/money';
import type { Period } from '../shared/period';
import { elapsedDaysInPeriod, periodLengthInDays, remainingDaysInPeriod } from '../shared/period';
import type { PlainDate } from '../shared/plain-date';
import {
  addMonths,
  differenceInDays,
  getParts,
  isAfter,
  makePlainDateClamped,
} from '../shared/plain-date';
import type { PeriodTotals } from './totals';

/**
 * "Se mantiver esse ritmo, voce terminara o mes com aproximadamente R$ X."
 *
 * A armadilha desta conta e extrapolar o que nao se repete.
 *
 * Uma parcela de emprestimo de R$ 440 lancada no dia 20 nao significa
 * "R$ 22 por dia" — ela acontece UMA vez no mes e nao vai acontecer de novo.
 * Tratar tudo como ritmo diario fazia o cenario do briefing projetar um
 * fechamento de -R$ 945, quando o saldo real do mes e +R$ 490: um erro grande
 * o bastante para assustar sem motivo.
 *
 * Por isso o ritmo e medido apenas sobre o gasto VARIAVEL, e o que ja esta
 * lancado e preservado:
 *
 *   projetado = ja gasto + (ritmo variavel x dias que faltam)
 *
 * Limitacao conhecida: so sao reconhecidos como fixos os lancamentos ligados a
 * uma conta recorrente ou a uma divida. Uma fatura de cartao lancada a mao,
 * sem vinculo, ainda entra no ritmo. A classificacao melhora sozinha conforme
 * as recorrencias forem cadastradas.
 */
export interface Projection {
  readonly totalDays: number;
  readonly elapsedDays: number;
  readonly remainingDays: number;

  /** Gasto ja lancado que nao se repete dentro do mes. */
  readonly fixedExpenseCents: Money;
  /** Media diaria do gasto variavel. Zero antes do periodo comecar. */
  readonly dailyBurnCents: Money;
  /** Gasto esperado no fechamento, mantido o ritmo variavel. */
  readonly projectedExpenseCents: Money;
  readonly projectedBalanceCents: Money;

  /**
   * Quanto cabe por dia nos dias restantes para fechar sem negativar.
   * `null` quando nao resta dia nenhum — nao ha quociente a calcular.
   */
  readonly dailyAllowanceCents: Money | null;
}

export interface ProjectionInput {
  readonly totals: PeriodTotals;
  readonly period: Period;
  readonly today: PlainDate;
  /**
   * Lancamentos do periodo. Obrigatorio: sem eles e impossivel saber o que ja
   * aconteceu e o que apenas esta agendado, e a projecao vira chute.
   */
  readonly transactions: readonly Transaction[];
}

/** Lancamentos que, por construcao, acontecem uma vez por mes. */
function isFixedCommitment(transaction: Transaction): boolean {
  return transaction.recurringBillId !== undefined || transaction.debtId !== undefined;
}

export function calculateProjection({
  totals,
  period,
  today,
  transactions,
}: ProjectionInput): Projection {
  const totalDays = periodLengthInDays(period);
  const elapsedDays = elapsedDaysInPeriod(period, today);
  const remainingDays = remainingDaysInPeriod(period, today);

  const expenses = transactions.filter((transaction) => transaction.type === 'expense');

  const fixedExpenseCents = sumMoney(
    expenses.filter(isFixedCommitment).map((transaction) => transaction.amountCents),
  );

  /**
   * O ritmo so pode medir o que JA aconteceu.
   *
   * Um lancamento com data futura dentro do mes — a fatura que vence dia 28,
   * por exemplo — ja esta registrado, mas ainda nao foi gasto. Conta-lo no
   * ritmo diario foi o que fez a tela anunciar um fechamento de -R$ 10.170 no
   * dia 5 do mes: R$ 2.050 divididos por 5 dias, como se tudo tivesse sido
   * gasto na primeira semana.
   */
  const elapsedVariableExpense = sumMoney(
    expenses
      .filter((transaction) => transaction.date <= today && !isFixedCommitment(transaction))
      .map((transaction) => transaction.amountCents),
  );

  // Antes do primeiro dia do periodo nao ha ritmo a medir.
  const dailyBurnCents =
    elapsedDays > 0 ? divideMoney(elapsedVariableExpense, elapsedDays) : ZERO_MONEY;

  // O que ja foi gasto e fato e permanece; so os dias que faltam sao estimados.
  const projectedExpenseCents =
    remainingDays > 0
      ? addMoney(totals.expense, multiplyMoney(dailyBurnCents, remainingDays))
      : totals.expense;

  const projectedBalanceCents = subtractMoney(totals.income, projectedExpenseCents);

  const available = clampMoneyToZero(totals.balance);
  const dailyAllowanceCents = remainingDays > 0 ? divideMoney(available, remainingDays) : null;

  return {
    totalDays,
    elapsedDays,
    remainingDays,
    fixedExpenseCents,
    dailyBurnCents,
    projectedExpenseCents,
    projectedBalanceCents,
    dailyAllowanceCents,
  };
}

/** "Quanto posso gastar ate o proximo salario?" */
export interface SalaryRunway {
  readonly nextSalaryDate: PlainDate;
  readonly daysUntilSalary: number;
  readonly availableCents: Money;
  /** `null` quando o salario cai hoje: nao existe "por dia" para zero dia. */
  readonly dailyAllowanceCents: Money | null;
}

/**
 * Data do proximo salario a partir de hoje. O dia e limitado ao ultimo dia do
 * mes — "todo dia 31" cai em 28/29 de fevereiro, nunca vaza para marco.
 */
export function nextSalaryDate(today: PlainDate, salaryDay: number): PlainDate {
  const { year, month } = getParts(today);
  const thisMonth = makePlainDateClamped(year, month, salaryDay);
  return isAfter(today, thisMonth) ? addMonths(thisMonth, 1) : thisMonth;
}

export function calculateSalaryRunway(
  totals: PeriodTotals,
  today: PlainDate,
  salaryDay: number,
): SalaryRunway {
  const salaryDate = nextSalaryDate(today, salaryDay);
  const daysUntilSalary = differenceInDays(today, salaryDate);
  const availableCents = clampMoneyToZero(totals.balance);

  return {
    nextSalaryDate: salaryDate,
    daysUntilSalary,
    availableCents,
    dailyAllowanceCents: daysUntilSalary > 0 ? divideMoney(availableCents, daysUntilSalary) : null,
  };
}
