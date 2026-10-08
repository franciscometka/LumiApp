import type { MonthlyPlan } from '../entities/monthly-plan';
import type { Money } from '../shared/money';
import { ZERO_MONEY, subtractMoney } from '../shared/money';
import { safePercentage } from '../shared/percentage';

import type { PeriodTotals } from './totals';

/**
 * ============================================================================
 * Progresso do planejamento mensal — a UNICA autoridade.
 * ============================================================================
 *
 * Nenhum componente calcula percentual, sobra, diferenca ou folga. Tudo sai
 * daqui pronto, pelo mesmo motivo do Dashboard: duas telas que fazem a mesma
 * conta por conta propria acabam discordando, e discordar sobre dinheiro e
 * pior do que nao mostrar.
 *
 * ## Tres principios que governam este modulo
 *
 * **1. Nenhuma conta perde o sinal.**
 * Barra visual nao pode voltar para dentro do dominio. Se a economia
 * projetada e -R$ 110 contra uma meta de R$ 500, o progresso e -22%, e e isso
 * que fica gravado aqui. A barra renderiza vazia porque barra negativa nao
 * existe, mas o clamp e EXCLUSIVO da apresentacao (`...ForDisplay`), e o texto
 * continua dizendo "R$ 610 abaixo da meta".
 *
 * **2. Numerador zero nao e divisao por zero.**
 * Esperar R$ 3.000 e ter recebido R$ 0 e **0%** — uma informacao real e util.
 * Apenas quando o DENOMINADOR e zero o percentual e `null`, porque ai nao
 * existe pergunta a responder: sem meta declarada nao ha progresso a medir.
 *
 * **3. Dinheiro movido nao e dinheiro ganho.**
 * O progresso da renda usa `earnedIncome`, nao `income`. Usar R$ 100 da
 * reserva aumenta o caixa do mes, nao a renda gerada — e contar isso como
 * progresso de meta de renda seria premiar a pessoa por mover o proprio
 * dinheiro de lugar.
 *
 * **4. Guardar dinheiro nao e gastar.**
 * O limite de gastos mede CONSUMO: usa `operationalExpense`, nao `expense`.
 * Mandar R$ 500 para a reserva mexe no caixa e no saldo, mas nao consome o
 * orcamento — antes da correcao do Lote 9, guardar uma sobra fazia o mes
 * "estourar o limite". O saldo (`balance`) continua contando transferencias.
 */

/** Como as tres metas se relacionam entre si. */
export interface PlanCoherence {
  /** `rendaEsperada - metaEconomia`: o que sobra para gastar. */
  readonly plannedBudgetCents: Money;
  /**
   * `plannedBudget - limiteGastos`.
   *
   * Negativo significa que cumprir o limite impede cumprir a meta: com renda
   * 3.000, meta 500 e limite 2.900, gastar tudo que o limite permite fecha o
   * mes com 100, nao com 500.
   */
  readonly slackCents: Money;
  /** `slack < 0`. Um aviso, nunca um bloqueio: o plano pode ser salvo assim. */
  readonly isInconsistent: boolean;
}

export interface PlanProgress {
  /**
   * `false` quando nao existe planejamento para o mes.
   *
   * Distinto de um plano configurado com zeros: "nao planejei" e "planejei
   * nao gastar nada" sao afirmacoes diferentes, e a tela precisa saber qual
   * das duas esta diante dela.
   */
  readonly hasPlan: boolean;

  /* -------- Renda -------- */
  readonly expectedIncomeCents: Money;
  /** RENDA GERADA no mes. Transferencia de reserva nao entra. */
  readonly earnedIncomeCents: Money;
  /** `null` apenas quando nao ha renda esperada. Zero recebido vira 0%. */
  readonly incomePercentage: number | null;
  /** Quanto falta receber. Negativo quando recebeu mais do que esperava. */
  readonly incomeDifferenceCents: Money;

  /* -------- Gastos -------- */
  readonly spendingLimitCents: Money;
  /**
   * Gasto OPERACIONAL lancado: pago + pendente, contado uma vez so.
   * Transferencia para a reserva nao entra.
   */
  readonly committedSpendingCents: Money;
  /** Gasto operacional que ja saiu da conta. */
  readonly paidSpendingCents: Money;
  /** Gasto operacional lancado mas ainda nao pago. */
  readonly pendingSpendingCents: Money;
  readonly spendingPercentage: number | null;
  /** Fracao JA PAGA do limite, para a camada solida da barra. */
  readonly paidSpendingPercentage: number | null;
  /**
   * `limite - comprometido`. **Pode ser negativo** — estourar o limite e um
   * fato, e mascarar isso em zero esconderia justamente o que importa.
   */
  readonly remainingToSpendCents: Money;
  readonly isOverLimit: boolean;
  /** Quanto passou do limite. Zero quando nao passou. */
  readonly overLimitCents: Money;

  /* -------- Meta de economia -------- */
  readonly savingsGoalCents: Money;
  /**
   * Economia do mes: renda gerada - gastos operacionais, com tudo que esta
   * lancado (pago + pendente). NAO e o saldo de caixa. Pode ser negativa.
   */
  readonly projectedSavingsCents: Money;
  /** Progresso REAL, com sinal. -22% permanece -22%. */
  readonly savingsPercentage: number | null;
  /** Diferenca para a meta. Negativo = falta; positivo = superou. */
  readonly savingsDifferenceCents: Money;
  readonly isGoalReached: boolean;

  /* -------- Coerencia do plano -------- */
  readonly coherence: PlanCoherence;

  /* -------- Atividade -------- */
  /** Se existe qualquer lancamento no mes. Separa "0%" de "nada lancado". */
  readonly hasActivity: boolean;
}

export const EMPTY_PLAN_PROGRESS: PlanProgress = {
  hasPlan: false,

  expectedIncomeCents: ZERO_MONEY,
  earnedIncomeCents: ZERO_MONEY,
  incomePercentage: null,
  incomeDifferenceCents: ZERO_MONEY,

  spendingLimitCents: ZERO_MONEY,
  committedSpendingCents: ZERO_MONEY,
  paidSpendingCents: ZERO_MONEY,
  pendingSpendingCents: ZERO_MONEY,
  spendingPercentage: null,
  paidSpendingPercentage: null,
  remainingToSpendCents: ZERO_MONEY,
  isOverLimit: false,
  overLimitCents: ZERO_MONEY,

  savingsGoalCents: ZERO_MONEY,
  projectedSavingsCents: ZERO_MONEY,
  savingsPercentage: null,
  savingsDifferenceCents: ZERO_MONEY,
  isGoalReached: false,

  coherence: {
    plannedBudgetCents: ZERO_MONEY,
    slackCents: ZERO_MONEY,
    isInconsistent: false,
  },

  hasActivity: false,
};

/** Coerencia das tres metas entre si. Nao depende de transacao nenhuma. */
export function calculatePlanCoherence(plan: MonthlyPlan): PlanCoherence {
  const plannedBudgetCents = subtractMoney(plan.expectedIncomeCents, plan.savingsGoalCents);
  const slackCents = subtractMoney(plannedBudgetCents, plan.spendingLimitCents);

  return {
    plannedBudgetCents,
    slackCents,
    isInconsistent: slackCents < 0,
  };
}

export function calculatePlanProgress(
  totals: PeriodTotals,
  plan: MonthlyPlan | null,
): PlanProgress {
  if (plan === null) {
    // Sem plano, o progresso nao e "tudo zero" — e inexistente. A atividade
    // do mes continua sendo reportada para a tela decidir o que dizer.
    return { ...EMPTY_PLAN_PROGRESS, hasActivity: totals.transactionCount > 0 };
  }

  const { expectedIncomeCents, spendingLimitCents, savingsGoalCents } = plan;

  /**
   * `earnedIncome`, nao `income`: dinheiro vindo da reserva nao e renda
   * gerada no mes e nao pode empurrar o progresso da meta de renda.
   */
  const earnedIncomeCents = totals.earnedIncome;

  /**
   * `totals.operationalExpense` ja soma pago + pendente, cada lancamento UMA
   * vez, e deixa de fora as transferencias (guardar na reserva nao e gasto).
   * Toda a conta de "quanto ainda posso gastar" parte deste unico numero,
   * entao nao existe onde duplicar: somar pendentes por fora e que criaria o
   * problema.
   *
   * Consequencia que vale entender: dar baixa numa conta (pendente -> pago)
   * NAO muda `remainingToSpend`. O dinheiro ja estava comprometido; mudou
   * apenas o momento em que saiu.
   */
  const committedSpendingCents = totals.operationalExpense;
  const remainingToSpendCents = subtractMoney(spendingLimitCents, committedSpendingCents);

  /**
   * Economia do mes = renda gerada - gastos operacionais (`operationalBalance`).
   *
   * Nao e o saldo. Transferencias ficam fora dos dois lados: retirar R$ 100
   * da reserva nao produz economia, e guardar R$ 500 nela nao a destroi —
   * antes do Lote 10 esta conta usava `totals.balance`, e mandar dinheiro
   * para a reserva DIMINUIA a "economia". A meta responde "quanto da renda
   * gerada deve sobrar depois do consumo", nao "quanto foi transferido".
   */
  const projectedSavingsCents = totals.operationalBalance;
  const savingsDifferenceCents = subtractMoney(projectedSavingsCents, savingsGoalCents);

  return {
    hasPlan: true,

    expectedIncomeCents,
    earnedIncomeCents,
    // `safePercentage` devolve 0 com numerador zero e `null` so com
    // denominador zero — exatamente a distincao que esta tela precisa.
    incomePercentage: safePercentage(earnedIncomeCents, expectedIncomeCents),
    incomeDifferenceCents: subtractMoney(earnedIncomeCents, expectedIncomeCents),

    spendingLimitCents,
    committedSpendingCents,
    paidSpendingCents: totals.paidOperationalExpense,
    pendingSpendingCents: totals.pendingOperationalExpense,
    spendingPercentage: safePercentage(committedSpendingCents, spendingLimitCents),
    paidSpendingPercentage: safePercentage(totals.paidOperationalExpense, spendingLimitCents),
    remainingToSpendCents,
    isOverLimit: spendingLimitCents > 0 && committedSpendingCents > spendingLimitCents,
    overLimitCents:
      remainingToSpendCents < 0 ? (Math.abs(remainingToSpendCents) as Money) : ZERO_MONEY,

    savingsGoalCents,
    projectedSavingsCents,
    // COM SINAL. O clamp da barra e responsabilidade da apresentacao.
    savingsPercentage: safePercentage(projectedSavingsCents, savingsGoalCents),
    savingsDifferenceCents,
    isGoalReached: savingsGoalCents > 0 && projectedSavingsCents >= savingsGoalCents,

    coherence: calculatePlanCoherence(plan),

    hasActivity: totals.transactionCount > 0,
  };
}
