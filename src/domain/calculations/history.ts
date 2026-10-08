import type { MonthlyPlan } from '../entities/monthly-plan';
import type { Transaction } from '../entities/transaction';
import type { Money } from '../shared/money';
import { divideMoney, sumMoney } from '../shared/money';
import type { Period, PeriodResolver, PeriodTemporality } from '../shared/period';
import { periodTemporality } from '../shared/period';
import type { MonthKey, PlainDate } from '../shared/plain-date';
import { filterTransactions } from './filters';
import type { PlanProgress } from './plan-progress';
import { calculatePlanProgress } from './plan-progress';
import type { PeriodTotals } from './totals';
import { calculateTotals } from './totals';

/**
 * ============================================================================
 * Historico — "como meus meses tem evoluido?"
 * ============================================================================
 *
 * ## As tres metricas, e por que sao estas
 *
 * - **Renda gerada** = `totals.earnedIncome`. Dinheiro vindo da reserva nao e
 *   renda: R$ 3.000 de salario + R$ 100 da reserva aparecem como R$ 3.000. E a
 *   mesma grandeza que o Planejamento mede contra a renda esperada.
 * - **Gastos operacionais** = `totals.operationalExpense`. Guardar uma sobra
 *   na reserva nao e gastar. ATENCAO: o cartao "Gastos" do Dashboard e
 *   `totals.expense`, que inclui transferencias — por isso aqui o rotulo e
 *   outro. As duas metricas so coincidem em meses sem transferencia.
 * - **Resultado do mes** = `totals.operationalBalance`, isto e, renda gerada
 *   menos gastos operacionais. Nao e o "Saldo do mês" do Dashboard
 *   (`totals.balance`): aquele sobe quando se usa a reserva. Ranquear meses por
 *   ele premiaria o mes que mais esvaziou a poupanca.
 *
 * Nenhuma delas e calculada aqui: todas saem de `calculateTotals`, a mesma
 * funcao que alimenta Dashboard e Planejamento. O progresso do plano sai de
 * `calculatePlanProgress`, a unica autoridade sobre planos.
 *
 * ## Ausencia nao e zero
 *
 * Mes sem lancamento nenhum tem as tres metricas `null`, nao R$ 0. Ele aparece
 * na lista (a janela e de N meses, e esconder um buraco seria outra mentira),
 * mas nao entra em media, nem em melhor/pior mes.
 *
 * ## Mes que so tem o que o app gerou sozinho
 *
 * Abrir o Historico materializa as recorrencias dos meses da janela, e elas
 * nascem pendentes. Um maio em que a pessoa nao usou o app passa a ter
 * "Internet R$ 120 pendente" e nada mais. Os numeros sao reais — o Dashboard
 * de maio mostra o mesmo — mas tratar esse maio como mes financeiro realizado
 * o faria o "melhor mes do ano" por pura falta de registro. Por isso ele fica
 * fora do resumo, do mesmo jeito que o mes vazio.
 */

export const HISTORY_WINDOW_SIZES = [6, 12] as const;
export type HistoryWindowSize = (typeof HISTORY_WINDOW_SIZES)[number];
export const DEFAULT_HISTORY_WINDOW_SIZE: HistoryWindowSize = 6;

/** Abaixo disso, media e ranking descreveriam um mes so e enganariam. */
export const MIN_MONTHS_FOR_SUMMARY = 2;

export function isHistoryWindowSize(value: unknown): value is HistoryWindowSize {
  return HISTORY_WINDOW_SIZES.includes(value as HistoryWindowSize);
}

/**
 * Intervalo resolvido. `endMonth` faz parte da identidade: "6 meses terminando
 * em outubro" e "6 meses terminando em novembro" sao janelas diferentes.
 */
export interface HistoryWindow {
  readonly size: HistoryWindowSize;
  readonly endMonth: MonthKey;
  /** Do mais antigo ao mais recente, sem buracos. */
  readonly months: readonly MonthKey[];
  /** Do primeiro dia do mes mais antigo ao ultimo do mais recente. */
  readonly period: Period;
}

export function resolveHistoryWindow(
  resolver: PeriodResolver,
  endMonth: MonthKey,
  size: HistoryWindowSize,
): HistoryWindow {
  const months: MonthKey[] = [endMonth];
  while (months.length < size) {
    months.unshift(resolver.previous(months[0] as MonthKey));
  }

  const first = resolver.resolve(months[0] as MonthKey);
  const last = resolver.resolve(endMonth);

  return {
    size,
    endMonth,
    months,
    period: { key: endMonth, start: first.start, end: last.end, label: last.label },
  };
}

/**
 * O que existe registrado no mes.
 *
 * - `empty`: nenhum lancamento.
 * - `generated_only`: so ocorrencias de recorrencia ainda pendentes — o app
 *   as criou, ninguem confirmou nada.
 * - `recorded`: ao menos um lancamento feito ou confirmado pela pessoa.
 */
export type MonthDataState = 'empty' | 'generated_only' | 'recorded';

export function monthDataState(transactions: readonly Transaction[]): MonthDataState {
  if (transactions.length === 0) return 'empty';
  const onlyGenerated = transactions.every(
    (transaction) => transaction.recurringBillId !== undefined && transaction.status === 'pending',
  );
  return onlyGenerated ? 'generated_only' : 'recorded';
}

/**
 * Situacao do plano, resumida para uma linha.
 *
 * Deriva de `PlanProgress`; nenhum percentual e refeito aqui.
 * - `none`: sem plano.
 * - `no_limit`: ha plano, mas sem limite de gastos para medir.
 * - `within_limit` / `over_limit`: comparacao com o limite.
 */
export type HistoryPlanStatus = 'none' | 'no_limit' | 'within_limit' | 'over_limit';

export function historyPlanStatus(plan: PlanProgress): HistoryPlanStatus {
  if (!plan.hasPlan) return 'none';
  if (plan.spendingLimitCents === 0) return 'no_limit';
  return plan.isOverLimit ? 'over_limit' : 'within_limit';
}

export interface HistoryMonth {
  readonly month: MonthKey;
  readonly period: Period;
  readonly temporality: PeriodTemporality;
  readonly dataState: MonthDataState;

  /** `null` quando o mes nao tem lancamento. Nunca R$ 0 inventado. */
  readonly earnedIncome: Money | null;
  readonly operationalExpense: Money | null;
  readonly result: Money | null;

  /** Totais completos, identicos aos do Dashboard para o mesmo mes. */
  readonly totals: PeriodTotals;
  /** Identico ao `snapshot.plan` do mesmo mes. */
  readonly plan: PlanProgress;
  readonly planStatus: HistoryPlanStatus;

  /** Encerrado e com registro da pessoa: entra em media e ranking. */
  readonly isEligible: boolean;
}

export interface RankedMonth {
  readonly month: MonthKey;
  readonly result: Money;
}

/**
 * Discriminado por `isAvailable`: com resumo, as medias sao `Money`; sem,
 * sao `null`. A tela nao tem como exibir uma media inexistente como R$ 0.
 */
export type HistorySummary =
  | {
      /** Menos de `MIN_MONTHS_FOR_SUMMARY` elegiveis. */
      readonly isAvailable: false;
      readonly eligibleCount: number;
      readonly averageEarnedIncome: null;
      readonly averageOperationalExpense: null;
      readonly best: null;
      readonly worst: null;
    }
  | {
      readonly isAvailable: true;
      /** Meses elegiveis na janela. */
      readonly eligibleCount: number;
      readonly averageEarnedIncome: Money;
      readonly averageOperationalExpense: Money;
      /** Maior resultado. Empate: o mais recente. `null` se todos empataram. */
      readonly best: RankedMonth | null;
      /** Menor resultado. Empate: o mais recente. `null` se todos empataram. */
      readonly worst: RankedMonth | null;
    };

export interface History {
  readonly window: HistoryWindow;
  readonly today: PlainDate;
  /** Na ordem da janela: do mais antigo ao mais recente. */
  readonly months: readonly HistoryMonth[];
  readonly summary: HistorySummary;
  /** Quantos meses da janela tem qualquer lancamento. */
  readonly monthsWithData: number;
}

export interface HistoryInput {
  /** Lista ampla; o recorte por mes acontece aqui dentro. */
  readonly transactions: readonly Transaction[];
  readonly plans: readonly MonthlyPlan[];
  readonly resolver: PeriodResolver;
  readonly window: HistoryWindow;
  readonly today: PlainDate;
}

export function buildHistory({
  transactions,
  plans,
  resolver,
  window,
  today,
}: HistoryInput): History {
  const plansByMonth = new Map(
    plans.filter((plan) => plan.deletedAt === undefined).map((plan) => [plan.month, plan]),
  );

  const months = window.months.map((month) =>
    buildHistoryMonth({
      month,
      // O mesmo recorte de `buildSnapshot`: `filterTransactions` por periodo.
      transactions: filterTransactions(transactions, { period: resolver.resolve(month) }),
      plan: plansByMonth.get(month) ?? null,
      resolver,
      today,
    }),
  );

  return {
    window,
    today,
    months,
    summary: summarizeHistory(months),
    monthsWithData: months.filter((month) => month.dataState !== 'empty').length,
  };
}

function buildHistoryMonth({
  month,
  transactions,
  plan,
  resolver,
  today,
}: {
  month: MonthKey;
  transactions: readonly Transaction[];
  plan: MonthlyPlan | null;
  resolver: PeriodResolver;
  today: PlainDate;
}): HistoryMonth {
  const period = resolver.resolve(month);
  const temporality = periodTemporality(period, today);
  const totals = calculateTotals(transactions);
  const progress = calculatePlanProgress(totals, plan);
  const dataState = monthDataState(transactions);
  const hasData = dataState !== 'empty';

  return {
    month,
    period,
    temporality,
    dataState,
    earnedIncome: hasData ? totals.earnedIncome : null,
    operationalExpense: hasData ? totals.operationalExpense : null,
    result: hasData ? totals.operationalBalance : null,
    totals,
    plan: progress,
    planStatus: historyPlanStatus(progress),
    isEligible: temporality === 'past' && dataState === 'recorded',
  };
}

/**
 * Media e ranking sobre os meses ELEGIVEIS: encerrados (`past`) e com
 * registro da pessoa. Ficam de fora o mes atual (ainda em andamento), os
 * futuros, os vazios e os que so tem recorrencias geradas.
 */
export function summarizeHistory(months: readonly HistoryMonth[]): HistorySummary {
  const eligible = months.filter((month) => month.isEligible);
  const eligibleCount = eligible.length;

  if (eligibleCount < MIN_MONTHS_FOR_SUMMARY) {
    return {
      eligibleCount,
      isAvailable: false,
      averageEarnedIncome: null,
      averageOperationalExpense: null,
      best: null,
      worst: null,
    };
  }

  // Elegivel implica `recorded`, entao as tres metricas existem.
  const ranked: RankedMonth[] = eligible.map((month) => ({
    month: month.month,
    result: month.result as Money,
  }));

  let best = ranked[0] as RankedMonth;
  let worst = ranked[0] as RankedMonth;
  // A janela vem do mais antigo ao mais recente; `>=`/`<=` fazem o mais
  // recente vencer o empate.
  for (const entry of ranked) {
    if (entry.result >= best.result) best = entry;
    if (entry.result <= worst.result) worst = entry;
  }

  const allTied = best.result === worst.result;

  return {
    eligibleCount,
    isAvailable: true,
    averageEarnedIncome: divideMoney(
      sumMoney(eligible.map((month) => month.earnedIncome as Money)),
      eligibleCount,
    ),
    averageOperationalExpense: divideMoney(
      sumMoney(eligible.map((month) => month.operationalExpense as Money)),
      eligibleCount,
    ),
    // Com todos empatados, "melhor" e "pior" seriam o mesmo numero com dois
    // nomes — nao ha ranking a mostrar.
    best: allTied ? null : best,
    worst: allTied ? null : worst,
  };
}
