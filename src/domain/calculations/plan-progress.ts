import type { Money } from '../shared/money';
import { ZERO_MONEY, clampMoneyToZero, subtractMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';
import type { MonthlyPlan } from '../entities/monthly-plan';
import type { PeriodTotals } from './totals';

/**
 * Progresso das metas do periodo.
 *
 * Todo percentual e `number | null`: sem meta definida nao existe progresso,
 * e "0%" seria uma afirmacao falsa sobre um objetivo que nunca foi declarado.
 * A UI mostra "—" nesses casos.
 */
export interface PlanProgress {
  readonly hasPlan: boolean;

  readonly expectedIncomeCents: Money;
  readonly actualIncomeCents: Money;
  readonly incomePercentage: number | null;

  readonly spendingLimitCents: Money;
  readonly actualSpendingCents: Money;
  readonly spendingPercentage: number | null;
  /** Quanto ainda cabe dentro do limite. Nunca negativo. */
  readonly spendingRemainingCents: Money;
  readonly isOverLimit: boolean;
  readonly overLimitCents: Money;

  readonly savingsGoalCents: Money;
  /** Economia realizada = saldo do periodo, limitado a zero. */
  readonly actualSavingsCents: Money;
  readonly savingsPercentage: number | null;

  /** "Voce ja utilizou 84% da sua renda deste mes." */
  readonly incomeUsagePercentage: number | null;
}

export const EMPTY_PLAN_PROGRESS: PlanProgress = {
  hasPlan: false,
  expectedIncomeCents: ZERO_MONEY,
  actualIncomeCents: ZERO_MONEY,
  incomePercentage: null,
  spendingLimitCents: ZERO_MONEY,
  actualSpendingCents: ZERO_MONEY,
  spendingPercentage: null,
  spendingRemainingCents: ZERO_MONEY,
  isOverLimit: false,
  overLimitCents: ZERO_MONEY,
  savingsGoalCents: ZERO_MONEY,
  actualSavingsCents: ZERO_MONEY,
  savingsPercentage: null,
  incomeUsagePercentage: null,
};

export function calculatePlanProgress(
  totals: PeriodTotals,
  plan: MonthlyPlan | null,
): PlanProgress {
  const expectedIncomeCents = plan?.expectedIncomeCents ?? ZERO_MONEY;
  const spendingLimitCents = plan?.spendingLimitCents ?? ZERO_MONEY;
  const savingsGoalCents = plan?.savingsGoalCents ?? ZERO_MONEY;

  const actualSavingsCents = clampMoneyToZero(totals.balance);
  const overLimitCents = clampMoneyToZero(
    subtractMoney(totals.expense, spendingLimitCents),
  );

  return {
    hasPlan: plan !== null,

    expectedIncomeCents,
    actualIncomeCents: totals.income,
    incomePercentage: safePercentage(totals.income, expectedIncomeCents),

    spendingLimitCents,
    actualSpendingCents: totals.expense,
    spendingPercentage: safePercentage(totals.expense, spendingLimitCents),
    spendingRemainingCents: clampMoneyToZero(
      subtractMoney(spendingLimitCents, totals.expense),
    ),
    isOverLimit: spendingLimitCents > 0 && totals.expense > spendingLimitCents,
    overLimitCents,

    savingsGoalCents,
    actualSavingsCents,
    savingsPercentage: safePercentage(actualSavingsCents, savingsGoalCents),

    incomeUsagePercentage: safePercentage(totals.expense, totals.income),
  };
}
