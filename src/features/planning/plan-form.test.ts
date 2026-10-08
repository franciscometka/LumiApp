import { describe, expect, it } from 'vitest';

import { makePlan } from '@/domain/__testing__/factories';

import {
  emptyPlanValues,
  planValuesCopiedFrom,
  planValuesFrom,
  previewCoherence,
  validatePlanForm,
} from './plan-form';
import type { PlanFormValues } from './plan-form';

function values(overrides: Partial<PlanFormValues> = {}): PlanFormValues {
  return {
    expectedIncome: '3.000,00',
    spendingLimit: '2.500,00',
    savingsGoal: '500,00',
    ...overrides,
  };
}

describe('validacao', () => {
  it('converte pelo caminho canonico, sem float', () => {
    const result = validatePlanForm(values());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.expectedIncomeCents).toBe(300000);
      expect(result.draft.spendingLimitCents).toBe(250000);
      expect(result.draft.savingsGoalCents).toBe(50000);
    }
  });

  it('aceita os formatos brasileiros', () => {
    for (const [texto, esperado] of [
      ['3000', 300000],
      ['3.000', 300000],
      ['3000,5', 300050],
      ['1.234,56', 123456],
      ['0,07', 7],
    ] as const) {
      const result = validatePlanForm(values({ expectedIncome: texto }));
      if (result.ok) expect(result.draft.expectedIncomeCents, texto).toBe(esperado);
    }
  });

  it('zero e legitimo em todos os campos', () => {
    // Um mes sem renda prevista existe. Uma meta zerada existe.
    const result = validatePlanForm({
      expectedIncome: '0',
      spendingLimit: '0',
      savingsGoal: '0',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.expectedIncomeCents).toBe(0);
      expect(result.draft.spendingLimitCents).toBe(0);
      expect(result.draft.savingsGoalCents).toBe(0);
    }
  });

  it('campo vazio vale zero', () => {
    const result = validatePlanForm({ expectedIncome: '', spendingLimit: '', savingsGoal: '' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.expectedIncomeCents).toBe(0);
  });

  it('recusa negativo em qualquer campo', () => {
    for (const campo of ['expectedIncome', 'spendingLimit', 'savingsGoal'] as const) {
      const result = validatePlanForm(values({ [campo]: '-100' }));
      expect(result.ok, campo).toBe(false);
    }
  });

  it('recusa texto sem numero', () => {
    expect(validatePlanForm(values({ expectedIncome: 'abc' })).ok).toBe(false);
  });

  it('ACEITA um plano que se contradiz', () => {
    // Meta + limite acima da renda. O app explica; nao decide pela pessoa.
    const result = validatePlanForm(
      values({ expectedIncome: '3.000,00', spendingLimit: '2.900,00', savingsGoal: '500,00' }),
    );

    expect(result.ok).toBe(true);
  });

  it('aceita meta maior que a renda', () => {
    const result = validatePlanForm(
      values({ expectedIncome: '1.000,00', savingsGoal: '1.500,00' }),
    );
    expect(result.ok).toBe(true);
  });

  it('aceita limite maior que a renda', () => {
    const result = validatePlanForm(
      values({ expectedIncome: '1.000,00', spendingLimit: '5.000,00' }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('previa de coerencia', () => {
  it('plano coerente reporta a folga', () => {
    const preview = previewCoherence(
      values({ expectedIncome: '3.000,00', spendingLimit: '2.000,00', savingsGoal: '500,00' }),
    );

    expect(preview).not.toBeNull();
    expect(preview?.plannedBudgetCents).toBe(250000);
    expect(preview?.slackCents).toBe(50000);
    expect(preview?.isInconsistent).toBe(false);
  });

  it('detecta o plano do exemplo problematico', () => {
    // Renda 3.000, meta 500, limite 2.900 → fecha com 100, nao 500.
    const preview = previewCoherence(
      values({ expectedIncome: '3.000,00', spendingLimit: '2.900,00', savingsGoal: '500,00' }),
    );

    expect(preview?.isInconsistent).toBe(true);
    expect(preview?.slackCents).toBe(-40000);
    expect(preview?.actualClosingCents).toBe(10000);
    expect(preview?.savingsGoalCents).toBe(50000);
  });

  it('exatamente coerente nao e inconsistente', () => {
    const preview = previewCoherence(
      values({ expectedIncome: '3.000,00', spendingLimit: '2.500,00', savingsGoal: '500,00' }),
    );

    expect(preview?.slackCents).toBe(0);
    expect(preview?.isInconsistent).toBe(false);
  });

  it('nao avisa sobre o que ainda nao e numero', () => {
    // Avisar no meio da digitacao seria ruido, nao ajuda.
    expect(previewCoherence(values({ expectedIncome: 'ab' }))).toBeNull();
  });

  it('nao avisa quando nada foi declarado', () => {
    expect(previewCoherence({ expectedIncome: '', spendingLimit: '', savingsGoal: '' })).toBeNull();
    expect(previewCoherence({ expectedIncome: '0', spendingLimit: '0', savingsGoal: '0' })).toBeNull();
  });
});

describe('copiar do mes anterior', () => {
  it('devolve apenas TEXTO, nunca um plano salvo', () => {
    const anterior = makePlan({
      expectedIncomeCents: 300000,
      spendingLimitCents: 250000,
      savingsGoalCents: 50000,
    });

    const copiado = planValuesCopiedFrom(anterior);

    expect(copiado).toEqual({
      expectedIncome: '3.000,00',
      spendingLimit: '2.500,00',
      savingsGoal: '500,00',
    });
    // Nenhum id, nenhum mes: nao e um plano, e um preenchimento de formulario.
    expect('id' in copiado).toBe(false);
    expect('month' in copiado).toBe(false);
  });

  it('o resultado passa pela mesma validacao de qualquer digitacao', () => {
    const copiado = planValuesCopiedFrom(makePlan({ expectedIncomeCents: 123456 }));
    const result = validatePlanForm(copiado);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.draft.expectedIncomeCents).toBe(123456);
  });
});

describe('ida e volta', () => {
  it('editar e salvar sem mudar nada preserva os valores', () => {
    const plano = makePlan({
      expectedIncomeCents: 300000,
      spendingLimitCents: 250000,
      savingsGoalCents: 50000,
    });

    const result = validatePlanForm(planValuesFrom(plano));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.draft.expectedIncomeCents).toBe(300000);
      expect(result.draft.spendingLimitCents).toBe(250000);
      expect(result.draft.savingsGoalCents).toBe(50000);
    }
  });

  it('o formulario novo comeca vazio, nao zerado', () => {
    // Vazio e zero valem o mesmo na gravacao, mas a tela nao deve exibir
    // "R$ 0,00" em tres campos antes da pessoa digitar qualquer coisa.
    expect(emptyPlanValues()).toEqual({
      expectedIncome: '',
      spendingLimit: '',
      savingsGoal: '',
    });
  });
});
