import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { MoneyText } from '@/components/finan/money-text';
import type { PeriodComparison } from '@/domain/calculations/period-comparison';
import { formatPercentage } from '@/domain/shared/percentage';
import { cn } from '@/lib/utils';

/**
 * Comparacao com o periodo anterior.
 *
 * Fica por ultimo na pagina de proposito: e a informacao menos urgente de
 * todas. Saber que gastou 13,5% a mais nao muda o que fazer hoje — muda o que
 * pensar sobre o mes.
 *
 * Sem dados no mes anterior, a secao nao aparece. "+100%" a partir do zero
 * seria invencao, e "0%" seria mentira.
 *
 * Compara GASTOS OPERACIONAIS, nao saidas de caixa: guardar dinheiro na
 * reserva nao e "gastar a mais que no mes passado".
 */
export function MonthComparison({ comparison }: { comparison: PeriodComparison }) {
  if (!comparison.hasPreviousData) return null;

  const { operationalExpense: expense } = comparison;
  const change = expense.changePercentage;

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Comparado ao mês anterior
      </h2>

      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs">Gastos operacionais no mês passado</p>
          <MoneyText value={expense.previous} size="sm" className="mt-1 block" />
        </div>

        <div className="text-right">
          <p className="text-muted-foreground text-xs">Agora</p>
          <MoneyText value={expense.current} size="sm" className="mt-1 block" />
        </div>
      </div>

      <p
        className={cn(
          'mt-4 border-t pt-3 text-sm',
          // Gastar mais e desfavoravel; gastar menos e bom. A direcao crua nao
          // basta para escolher a cor.
          expense.trend === 'up' ? 'text-expense' : expense.trend === 'down' ? 'text-income' : 'text-muted-foreground',
        )}
      >
        {change === null
          ? 'Sem base para comparar o percentual.'
          : expense.trend === 'flat'
            ? 'Mesmo patamar do mês passado.'
            : `${formatPercentage(Math.abs(change), { decimals: 1 })} ${
                expense.trend === 'up' ? 'a mais' : 'a menos'
              } que no mês passado.`}
      </p>

      <Link
        href="/historico"
        className="text-primary -mx-1 mt-3 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-sm font-medium hover:underline"
      >
        Ver histórico
        <ChevronRight aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
