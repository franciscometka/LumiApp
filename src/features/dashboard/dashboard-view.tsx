'use client';

import { useSelectedMonth } from '@/features/period/use-selected-month';

import { BalanceHero } from './components/balance-hero';
import { CategoryDonut } from './components/category-donut';
import { DashboardError, DashboardSkeleton, EmptyMonth } from './components/dashboard-states';
import { InsightList } from './components/insight-list';
import { MonthComparison } from './components/month-comparison';
import { PendingBills } from './components/pending-bills';
import { StatCards } from './components/stat-cards';
import { useMonthlySnapshot } from './use-monthly-snapshot';

/**
 * Dashboard.
 *
 * Uma unica query, um unico snapshot. Saldo, entradas, gastos,
 * comprometimento, categorias, pendencias e comparacao saem todos da MESMA
 * fotografia — por construcao, dois numeros desta tela nao conseguem
 * discordar entre si.
 *
 * A ordem dos blocos e a hierarquia pedida no briefing, e vale literalmente
 * como ordem de leitura no celular:
 *
 *   1. saldo
 *   2. entradas e gastos
 *   3. insight
 *   4. contas pendentes
 *   5. categorias
 *   6. comparacao com o mes anterior
 *
 * O que nao cabe nessa lista nao entra na tela inicial.
 */
export function DashboardView() {
  const { month, label } = useSelectedMonth();
  const { data, isPending, isError, refetch } = useMonthlySnapshot(month);

  if (isPending) return <DashboardSkeleton />;
  if (isError || data === undefined) return <DashboardError onRetry={() => void refetch()} />;

  const { snapshot, expenseChart, categoriesById, insights } = data;

  if (snapshot.totals.transactionCount === 0) {
    return <EmptyMonth monthLabel={label} isFuture={snapshot.temporality === 'future'} />;
  }

  return (
    <div className="grid gap-4">
      <BalanceHero snapshot={snapshot} />

      <StatCards snapshot={snapshot} />

      <InsightList insights={insights} />

      <PendingBills
        pending={snapshot.pending}
        today={snapshot.today}
        categoriesById={categoriesById}
      />

      <CategoryDonut breakdown={expenseChart} categoriesById={categoriesById} />

      <MonthComparison comparison={snapshot.comparison} />
    </div>
  );
}
