import type { Money } from '../shared/money';
import { subtractMoney } from '../shared/money';
import { changePercentage } from '../shared/percentage';
import type { PeriodTotals } from './totals';

export type Trend = 'up' | 'down' | 'flat';

/**
 * "Estou gastando mais ou menos que no mes passado?"
 *
 * Os deltas em centavos sao sempre exatos. Os percentuais sao `null` quando o
 * periodo anterior foi zero: sair de R$ 0 para R$ 100 nao e "+100%", e um
 * comeco — e exibir um numero inventado ali destruiria a confianca no resto.
 */
export interface MetricComparison {
  readonly current: Money;
  readonly previous: Money;
  readonly deltaCents: Money;
  readonly changePercentage: number | null;
  readonly trend: Trend;
}

export interface PeriodComparison {
  readonly income: MetricComparison;
  readonly expense: MetricComparison;
  readonly balance: MetricComparison;
  readonly hasPreviousData: boolean;
}

function compareMetric(current: Money, previous: Money): MetricComparison {
  const deltaCents = subtractMoney(current, previous);
  return {
    current,
    previous,
    deltaCents,
    changePercentage: changePercentage(current, previous),
    trend: deltaCents > 0 ? 'up' : deltaCents < 0 ? 'down' : 'flat',
  };
}

export function comparePeriods(
  current: PeriodTotals,
  previous: PeriodTotals,
): PeriodComparison {
  return {
    income: compareMetric(current.income, previous.income),
    expense: compareMetric(current.expense, previous.expense),
    balance: compareMetric(current.balance, previous.balance),
    hasPreviousData: previous.transactionCount > 0,
  };
}

/**
 * Se a variacao representa melhora para o usuario.
 * Gastar mais e ruim; receber mais e bom. A direcao crua nao basta para a UI
 * escolher a cor.
 */
export function isFavorable(comparison: MetricComparison, metric: 'income' | 'expense' | 'balance'): boolean {
  if (comparison.trend === 'flat') return true;
  return metric === 'expense' ? comparison.trend === 'down' : comparison.trend === 'up';
}
