import { describe, expect, it } from 'vitest';

import { briefingScenario, cents, makeExpense, makeIncome, makePlan } from '../__testing__/factories';
import { roundPercentage } from '../shared/percentage';
import { EMPTY_PLAN_PROGRESS, calculatePlanProgress } from './plan-progress';
import { EMPTY_TOTALS, calculateTotals } from './totals';

describe('calculatePlanProgress', () => {
  it('mede o progresso contra as metas do briefing', () => {
    const totais = calculateTotals(briefingScenario());
    const plano = makePlan({
      expectedIncomeCents: 300000,
      spendingLimitCents: 250000,
      savingsGoalCents: 50000,
    });

    const progresso = calculatePlanProgress(totais, plano);

    expect(progresso.hasPlan).toBe(true);
    expect(roundPercentage(progresso.incomePercentage as number, 2)).toBe(103.33);
    expect(roundPercentage(progresso.spendingPercentage as number, 1)).toBe(104.4);
    expect(progresso.isOverLimit).toBe(true);
    expect(progresso.overLimitCents).toBe(11000);
    expect(progresso.spendingRemainingCents).toBe(0);
    expect(progresso.actualSavingsCents).toBe(49000);
    expect(roundPercentage(progresso.savingsPercentage as number, 0)).toBe(98);
  });

  it('devolve progresso vazio quando nao ha plano', () => {
    const progresso = calculatePlanProgress(EMPTY_TOTALS, null);
    expect(progresso).toEqual(EMPTY_PLAN_PROGRESS);
  });

  it('devolve null nos percentuais de metas nao definidas', () => {
    // Plano criado mas sem nenhuma meta preenchida: nada a dividir.
    const plano = makePlan({
      expectedIncomeCents: 0,
      spendingLimitCents: 0,
      savingsGoalCents: 0,
    });
    const totais = calculateTotals([makeExpense({ amountCents: 50000 })]);

    const progresso = calculatePlanProgress(totais, plano);

    expect(progresso.hasPlan).toBe(true);
    expect(progresso.incomePercentage).toBeNull();
    expect(progresso.spendingPercentage).toBeNull();
    expect(progresso.savingsPercentage).toBeNull();
    expect(progresso.isOverLimit).toBe(false); // sem limite nao ha estouro
  });

  it('calcula o que ainda cabe no limite', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 150000 })]);
    const progresso = calculatePlanProgress(totais, makePlan({ spendingLimitCents: 250000 }));

    expect(progresso.spendingRemainingCents).toBe(100000);
    expect(progresso.isOverLimit).toBe(false);
    expect(progresso.overLimitCents).toBe(0);
    expect(progresso.spendingPercentage).toBe(60);
  });

  it('nunca devolve sobra negativa nem economia negativa', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 100000 }),
      makeExpense({ amountCents: 400000 }),
    ]);
    const progresso = calculatePlanProgress(totais, makePlan({ spendingLimitCents: 250000 }));

    expect(totais.balance).toBe(-300000);
    expect(progresso.spendingRemainingCents).toBe(0);
    expect(progresso.overLimitCents).toBe(150000);
    expect(progresso.actualSavingsCents).toBe(0);
    expect(progresso.savingsPercentage).toBe(0);
  });

  it('expoe o uso da renda real, nao da renda esperada', () => {
    const totais = calculateTotals([
      makeIncome({ amountCents: 200000 }),
      makeExpense({ amountCents: 100000 }),
    ]);
    const progresso = calculatePlanProgress(
      totais,
      makePlan({ expectedIncomeCents: cents(400000) }),
    );

    expect(progresso.incomeUsagePercentage).toBe(50); // 100000 / 200000 real
    expect(progresso.incomePercentage).toBe(50); // 200000 / 400000 esperado
  });

  it('devolve null no uso da renda quando nao houve entrada', () => {
    const totais = calculateTotals([makeExpense({ amountCents: 100000 })]);
    expect(calculatePlanProgress(totais, makePlan()).incomeUsagePercentage).toBeNull();
  });
});
