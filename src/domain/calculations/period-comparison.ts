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

/**
 * Os nomes dizem o que se compara.
 *
 * "Gastou X% a mais" e uma frase sobre CONSUMO: compara gastos operacionais.
 * Guardar R$ 500 na reserva nao e gastar mais — antes do Lote 10 esta
 * comparacao usava `expense`, e economizar aparecia como gasto maior. Pelo
 * mesmo motivo a renda e a renda gerada. So o saldo e de caixa, e se chama
 * `balance`.
 */
export interface PeriodComparison {
  readonly earnedIncome: MetricComparison;
  readonly operationalExpense: MetricComparison;
  readonly balance: MetricComparison;
  readonly hasPreviousData: boolean;
}

export type ComparedMetric = 'earnedIncome' | 'operationalExpense' | 'balance';

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
    earnedIncome: compareMetric(current.earnedIncome, previous.earnedIncome),
    operationalExpense: compareMetric(current.operationalExpense, previous.operationalExpense),
    balance: compareMetric(current.balance, previous.balance),
    hasPreviousData: previous.transactionCount > 0,
  };
}

/**
 * Se a variacao representa melhora para o usuario.
 * Gastar mais e ruim; receber mais e bom. A direcao crua nao basta para a UI
 * escolher a cor.
 */
export function isFavorable(comparison: MetricComparison, metric: ComparedMetric): boolean {
  if (comparison.trend === 'flat') return true;
  return metric === 'operationalExpense' ? comparison.trend === 'down' : comparison.trend === 'up';
}
