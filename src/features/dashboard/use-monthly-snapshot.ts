'use client';

import { useQuery } from '@tanstack/react-query';

import type { CategoryBreakdown } from '@/domain/calculations/by-category';
import { groupSmallCategories } from '@/domain/calculations/by-category';
import type { PeriodSnapshot } from '@/domain/calculations/snapshot';
import { buildSnapshot } from '@/domain/calculations/snapshot';
import type { Category } from '@/domain/entities/category';
import { generateInsights } from '@/domain/insights/engine';
import type { Insight } from '@/domain/insights/types';
import type { ID } from '@/domain/shared/id';
import type { Period } from '@/domain/shared/period';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';
import { todayPlainDate } from '@/domain/shared/plain-date';

import type { DataSource } from '@/data/ports/data-source';
import { useDataSource } from '@/features/app/data-source-context';
import { useMonthReady } from '@/features/period/use-month-ready';
import { queryKeys } from '@/features/app/query-keys';

/**
 * Tudo que a Dashboard precisa, em um objeto so.
 *
 * Os componentes visuais nunca veem repositorio nem recalculam nada: recebem
 * dados prontos. Saldo, entradas, gastos, comprometimento, categorias e
 * comparacao saem TODOS do mesmo `snapshot`, o que torna impossivel dois
 * numeros da mesma tela discordarem entre si.
 */
export interface MonthlySnapshotData {
  readonly snapshot: PeriodSnapshot;
  /** Ja agrupado pelo dominio. A UI nao reagrupa. */
  readonly expenseChart: CategoryBreakdown;
  readonly categoriesById: ReadonlyMap<ID, Category>;
  readonly insights: readonly Insight[];
}

/** Quantas fatias o donut comporta antes de virar confete. */
const MAX_CHART_SLICES = 5;

/** Quantas frases cabem na tela inicial sem virar mural. */
const MAX_INSIGHTS = 2;

export async function loadMonthlySnapshot(
  dataSource: DataSource,
  month: MonthKey,
): Promise<MonthlySnapshotData> {
  const period = civilMonthResolver.resolve(month);
  const previousPeriod = civilMonthResolver.resolve(civilMonthResolver.previous(month));

  const [transactions, plan, settings, categories] = await Promise.all([
    // Busca a janela que cobre o periodo E o anterior, porque a comparacao
    // entre meses precisa dos dois. Filtrar aqui em vez de carregar tudo e o
    // que permite ao futuro adapter Supabase traduzir isto em um WHERE por
    // intervalo de datas, sem mudar nada acima.
    dataSource.transactions.findByFilter({
      period: spanningPeriod(previousPeriod, period),
    }),
    dataSource.monthlyPlans.findByMonth(month),
    dataSource.settings.get(),
    dataSource.categories.findAll(),
  ]);

  const snapshot = buildSnapshot({
    transactions,
    resolver: civilMonthResolver,
    period,
    today: todayPlainDate(settings.timeZone),
    plan,
    salaryDay: settings.salaryDay,
  });

  const categoriesById = new Map(categories.map((category) => [category.id, category]));

  return {
    snapshot,
    expenseChart: groupSmallCategories(snapshot.expenseByCategory, MAX_CHART_SLICES),
    categoriesById,
    insights: generateInsights(snapshot, {
      categoryName: (id) => categoriesById.get(id)?.name ?? null,
      limit: MAX_INSIGHTS,
    }),
  };
}

/**
 * Periodo artificial que cobre do inicio do anterior ao fim do atual.
 *
 * Serve apenas como recorte de busca; `buildSnapshot` continua separando os
 * dois meses corretamente.
 */
function spanningPeriod(previous: Period, current: Period): Period {
  return {
    key: current.key,
    start: previous.start,
    end: current.end,
    label: current.label,
  };
}

/**
 * Fotografia financeira do mes selecionado.
 *
 * A chave inclui o mes: trocar de mes e uma entrada de cache diferente, e
 * voltar para um mes ja visto reaproveita o resultado.
 */
/**
 * `enabled: isReady` e a aplicacao da ordem "visitar o mes garante suas
 * recorrencias": o snapshot so e calculado depois que a materializacao
 * daquele mes terminou. Sem isso, o Dashboard somaria um mes incompleto e
 * exibiria totais errados ate o refetch — numeros errados por pouco tempo
 * ainda sao numeros errados.
 *
 * A materializacao em si nao e responsabilidade desta feature: `useMonthReady`
 * mora no periodo e e compartilhado com Transacoes.
 */
export function useMonthlySnapshot(month: MonthKey) {
  const dataSource = useDataSource();
  const { isReady } = useMonthReady(month);

  return useQuery<MonthlySnapshotData>({
    queryKey: queryKeys.monthlySnapshot(month),
    queryFn: () => loadMonthlySnapshot(dataSource, month),
    enabled: isReady,
  });
}
