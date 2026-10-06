import type { Period, PeriodResolver, PeriodTemporality } from '../shared/period';
import { periodTemporality } from '../shared/period';
import type { PlainDate } from '../shared/plain-date';
import type { MonthlyPlan } from '../entities/monthly-plan';
import type { Transaction } from '../entities/transaction';
import type { CategoryBreakdown } from './by-category';
import { calculateCategoryBreakdown } from './by-category';
import type { CommitmentBreakdown } from './commitments';
import { calculateCommitments } from './commitments';
import { filterTransactions } from './filters';
import type { PeriodComparison } from './period-comparison';
import { comparePeriods } from './period-comparison';
import type { PendingSummary } from './pending';
import { calculatePending } from './pending';
import type { PlanProgress } from './plan-progress';
import { calculatePlanProgress } from './plan-progress';
import type { Projection, SalaryRunway } from './projection';
import { calculateProjection, calculateSalaryRunway } from './projection';
import type { PeriodTotals } from './totals';
import { calculateTotals } from './totals';

/**
 * Retrato completo de um periodo. E o unico objeto que a Dashboard precisa
 * consumir, e nada aqui e persistido: tudo e derivado das transacoes.
 *
 * A lista e recortada UMA vez e as metricas compartilham o mesmo recorte, o
 * que garante que dois numeros da mesma tela nunca discordem entre si.
 */
export interface PeriodSnapshot {
  readonly period: Period;
  readonly today: PlainDate;
  /**
   * Passado, atual ou futuro. Fica na fotografia para que a UI nunca
   * precise recalcular — e para que projecao e saldo realizado so apareçam
   * onde fazem sentido.
   */
  readonly temporality: PeriodTemporality;

  readonly totals: PeriodTotals;
  readonly expenseByCategory: CategoryBreakdown;
  readonly incomeByCategory: CategoryBreakdown;
  readonly commitments: CommitmentBreakdown;
  readonly pending: PendingSummary;
  readonly plan: PlanProgress;
  readonly projection: Projection;
  readonly salaryRunway: SalaryRunway | null;
  readonly comparison: PeriodComparison;

  readonly transactions: readonly Transaction[];
}

export interface SnapshotInput {
  /** Lista completa; o recorte por periodo acontece aqui dentro. */
  readonly transactions: readonly Transaction[];
  readonly resolver: PeriodResolver;
  readonly period: Period;
  readonly today: PlainDate;
  readonly plan?: MonthlyPlan | null;
  readonly salaryDay?: number;
  readonly dueSoonDays?: number;
}

export function buildSnapshot({
  transactions,
  resolver,
  period,
  today,
  plan = null,
  salaryDay,
  dueSoonDays,
}: SnapshotInput): PeriodSnapshot {
  const current = filterTransactions(transactions, { period });

  const previousPeriodValue = resolver.resolve(resolver.previous(period.key));
  const previous = filterTransactions(transactions, { period: previousPeriodValue });

  const totals = calculateTotals(current);
  const previousTotals = calculateTotals(previous);

  return {
    period,
    today,
    temporality: periodTemporality(period, today),
    totals,
    expenseByCategory: calculateCategoryBreakdown(current, { type: 'expense' }),
    incomeByCategory: calculateCategoryBreakdown(current, { type: 'income' }),
    commitments: calculateCommitments(current),
    pending: calculatePending(current, {
      today,
      ...(dueSoonDays === undefined ? {} : { dueSoonDays }),
    }),
    plan: calculatePlanProgress(totals, plan),
    projection: calculateProjection({ totals, period, today, transactions: current }),
    salaryRunway:
      salaryDay === undefined ? null : calculateSalaryRunway(totals, today, salaryDay),
    comparison: comparePeriods(totals, previousTotals),
    transactions: current,
  };
}
