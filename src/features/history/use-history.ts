'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { DataSource } from '@/data/ports/data-source';
import type { History, HistoryWindow, HistoryWindowSize } from '@/domain/calculations/history';
import { buildHistory, resolveHistoryWindow } from '@/domain/calculations/history';
import { monthsToPrepare } from '@/domain/calculations/materialization';
import { civilMonthResolver } from '@/domain/shared/period';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import { usePeriodsReady } from '../period/use-month-ready';

/**
 * Leitura do Historico. SOMENTE leitura: nenhuma escrita acontece aqui.
 *
 * A preparacao dos meses (materializar recorrencias) ja aconteceu antes, em
 * `usePeriodsReady`, e esta funcao so roda depois disso (`enabled`). Misturar
 * as duas coisas numa mesma `queryFn` faria uma leitura gravar em silencio —
 * exatamente o que o Lote 7 separou.
 *
 * Uma busca para a janela inteira, um recorte por mes no dominio.
 */
export async function loadHistory(dataSource: DataSource, window: HistoryWindow): Promise<History> {
  const [transactions, plans, settings] = await Promise.all([
    dataSource.transactions.findByFilter({ period: window.period }),
    dataSource.monthlyPlans.findAll(),
    dataSource.settings.get(),
  ]);

  return buildHistory({
    transactions,
    plans,
    resolver: civilMonthResolver,
    window,
    // O mesmo "hoje" do snapshot: a temporalidade de um mes no Historico e no
    // Dashboard nao pode divergir.
    today: todayPlainDate(settings.timeZone),
  });
}

/**
 * Historico da janela escolhida, terminando no mes atual.
 *
 *     janela -> usePeriodsReady(meses ate hoje) -> ready -> loadHistory (leitura)
 *
 * A chave inclui o mes de referencia: a janela de outubro e a de novembro sao
 * caches diferentes, e virar o mes com o app aberto nao reaproveita a errada.
 */
export function useHistory(size: HistoryWindowSize) {
  const dataSource = useDataSource();

  // Fixado por montagem, como em `useSelectedMonth`.
  const currentMonth = useMemo(() => civilMonthResolver.keyOf(todayPlainDate()), []);
  const window = useMemo(
    () => resolveHistoryWindow(civilMonthResolver, currentMonth, size),
    [currentMonth, size],
  );

  // Nunca alem do mes atual: o Historico olha para tras.
  const ready = usePeriodsReady(monthsToPrepare(window.months, currentMonth));

  const query = useQuery<History>({
    queryKey: queryKeys.historyWindow(size, window.endMonth),
    queryFn: () => loadHistory(dataSource, window),
    enabled: ready.isReady,
  });

  return {
    query,
    window,
    isPreparing: ready.isPreparing,
    createdSinceMount: ready.createdSinceMount,
  };
}
