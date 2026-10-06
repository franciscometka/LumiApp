import type { Money } from '../shared/money';
import {
  ZERO_MONEY,
  clampMoneyToZero,
  divideMoney,
  multiplyMoney,
  subtractMoney,
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
 * Projecao por regra simples: ritmo diario de gasto ate aqui, estendido aos
 * dias que faltam. Nao e previsao estatistica e nao pretende ser — e a mesma
 * conta que a pessoa faria de cabeca, so que certa.
 */
export interface Projection {
  readonly totalDays: number;
  readonly elapsedDays: number;
  readonly remainingDays: number;

  /** Media de gasto por dia decorrido. Zero antes do periodo comecar. */
  readonly dailyBurnCents: Money;
  /** Gasto esperado no fechamento, mantido o ritmo. */
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
}

export function calculateProjection({ totals, period, today }: ProjectionInput): Projection {
  const totalDays = periodLengthInDays(period);
  const elapsedDays = elapsedDaysInPeriod(period, today);
  const remainingDays = remainingDaysInPeriod(period, today);

  // Antes do primeiro dia do periodo nao ha ritmo a medir.
  const dailyBurnCents = elapsedDays > 0 ? divideMoney(totals.expense, elapsedDays) : ZERO_MONEY;

  const projectedExpenseCents =
    elapsedDays > 0 ? multiplyMoney(dailyBurnCents, totalDays) : totals.expense;

  const projectedBalanceCents = subtractMoney(totals.income, projectedExpenseCents);

  const available = clampMoneyToZero(totals.balance);
  const dailyAllowanceCents = remainingDays > 0 ? divideMoney(available, remainingDays) : null;

  return {
    totalDays,
    elapsedDays,
    remainingDays,
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
