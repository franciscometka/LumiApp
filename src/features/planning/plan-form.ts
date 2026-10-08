import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import type { Money } from '@/domain/shared/money';
import { formatMoneyPlain, parseMoney, subtractMoney } from '@/domain/shared/money';

/**
 * Estado e validacao do planejamento mensal. Sem React.
 *
 * A regra que distingue este formulario dos outros: **zero e legitimo em todos
 * os campos**. Um mes sem renda prevista existe; uma meta de economia zerada
 * existe. So o negativo e rejeitado, porque limite de gasto negativo nao
 * significa nada.
 *
 * E um plano que se contradiz — meta + limite acima da renda — tambem e
 * aceito. O app explica a consequencia; nao decide pelo usuario que o plano
 * dele e invalido.
 */
export interface PlanFormValues {
  readonly expectedIncome: string;
  readonly spendingLimit: string;
  readonly savingsGoal: string;
}

export interface PlanDraft {
  readonly expectedIncomeCents: Money;
  readonly spendingLimitCents: Money;
  readonly savingsGoalCents: Money;
}

export type PlanFormField = 'expectedIncome' | 'spendingLimit' | 'savingsGoal';
export type PlanFormErrors = Partial<Record<PlanFormField, string>>;

export type PlanFormResult =
  | { readonly ok: true; readonly draft: PlanDraft }
  | { readonly ok: false; readonly errors: PlanFormErrors };

export function emptyPlanValues(): PlanFormValues {
  return { expectedIncome: '', spendingLimit: '', savingsGoal: '' };
}

export function planValuesFrom(plan: MonthlyPlan): PlanFormValues {
  return {
    expectedIncome: formatMoneyPlain(plan.expectedIncomeCents),
    spendingLimit: formatMoneyPlain(plan.spendingLimitCents),
    savingsGoal: formatMoneyPlain(plan.savingsGoalCents),
  };
}

/**
 * Preenche o formulario com os valores de outro plano.
 *
 * Usado por "Usar valores de setembro". Devolve apenas TEXTO: nao salva, nao
 * cria nada e nao toca no plano de origem. O usuario revisa e decide.
 */
export function planValuesCopiedFrom(plan: MonthlyPlan): PlanFormValues {
  return planValuesFrom(plan);
}

/** Campo vazio vale zero; negativo e recusado. */
function parseNonNegative(raw: string): Money | null {
  if (raw.trim() === '') return 0 as Money;
  const value = parseMoney(raw);
  if (value === null || value < 0) return null;
  return value;
}

export function validatePlanForm(values: PlanFormValues): PlanFormResult {
  const errors: Record<string, string> = {};

  const expectedIncomeCents = parseNonNegative(values.expectedIncome);
  if (expectedIncomeCents === null) {
    errors.expectedIncome = 'Valor inválido. Use vírgula para os centavos.';
  }

  const spendingLimitCents = parseNonNegative(values.spendingLimit);
  if (spendingLimitCents === null) {
    errors.spendingLimit = 'Valor inválido. Use vírgula para os centavos.';
  }

  const savingsGoalCents = parseNonNegative(values.savingsGoal);
  if (savingsGoalCents === null) {
    errors.savingsGoal = 'Valor inválido. Use vírgula para os centavos.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors: errors as PlanFormErrors };
  }

  if (
    expectedIncomeCents === null ||
    spendingLimitCents === null ||
    savingsGoalCents === null
  ) {
    return { ok: false, errors: { expectedIncome: 'Dados inválidos.' } };
  }

  return { ok: true, draft: { expectedIncomeCents, spendingLimitCents, savingsGoalCents } };
}

/**
 * Previsao de coerencia ENQUANTO a pessoa digita.
 *
 * Roda sobre o texto do formulario, nao sobre o plano salvo, para que o aviso
 * apareca antes de salvar — e nao como uma surpresa depois.
 *
 * Devolve `null` quando os campos ainda nao formam numeros validos: avisar
 * sobre incoerencia de um valor que a pessoa esta no meio de digitar seria
 * ruido, nao ajuda.
 */
export interface CoherencePreview {
  readonly plannedBudgetCents: Money;
  readonly slackCents: Money;
  readonly isInconsistent: boolean;
  /** O que o mes de fato fecharia, gastando todo o limite. */
  readonly actualClosingCents: Money;
  /** A meta declarada, ja em centavos, para a frase do aviso. */
  readonly savingsGoalCents: Money;
}

export function previewCoherence(values: PlanFormValues): CoherencePreview | null {
  const result = validatePlanForm(values);
  if (!result.ok) return null;

  const { expectedIncomeCents, spendingLimitCents, savingsGoalCents } = result.draft;

  // Sem nenhuma meta declarada nao ha coerencia a avaliar.
  if (expectedIncomeCents === 0 && spendingLimitCents === 0 && savingsGoalCents === 0) {
    return null;
  }

  const plannedBudgetCents = subtractMoney(expectedIncomeCents, savingsGoalCents);
  const slackCents = subtractMoney(plannedBudgetCents, spendingLimitCents);

  return {
    plannedBudgetCents,
    slackCents,
    isInconsistent: slackCents < 0,
    actualClosingCents: subtractMoney(expectedIncomeCents, spendingLimitCents),
    savingsGoalCents,
  };
}
