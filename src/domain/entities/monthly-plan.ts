import { z } from 'zod';

import {
  idSchema,
  monthKeySchema,
  nonNegativeMoneySchema,
  timestampSchema,
} from '../shared/schemas';

/**
 * Metas declaradas pelo usuario para um periodo.
 * Zero e um valor legitimo (significa "nao defini meta"), negativo nao e.
 */
export const monthlyPlanSchema = z.object({
  id: idSchema,
  userId: idSchema,
  month: monthKeySchema,
  expectedIncomeCents: nonNegativeMoneySchema,
  spendingLimitCents: nonNegativeMoneySchema,
  savingsGoalCents: nonNegativeMoneySchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.optional(),
});

export type MonthlyPlan = z.infer<typeof monthlyPlanSchema>;

/** Um plano sem nenhuma meta preenchida nao deve gerar barras de progresso. */
export function isEmptyPlan(plan: MonthlyPlan): boolean {
  return (
    plan.expectedIncomeCents === 0 &&
    plan.spendingLimitCents === 0 &&
    plan.savingsGoalCents === 0
  );
}
