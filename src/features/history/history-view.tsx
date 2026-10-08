'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import type { HistoryWindowSize } from '@/domain/calculations/history';

import { HistoryChart } from './components/history-chart';
import {
  HistoryEmpty,
  HistoryError,
  HistorySkeleton,
  PreparedNotice,
} from './components/history-states';
import { HistorySummary } from './components/history-summary';
import { MonthList } from './components/month-list';
import { WindowToggle } from './components/window-toggle';
import { useHistory } from './use-history';
import { WINDOW_PARAM, resolveWindowParam } from './window-param';

/**
 * Historico.
 *
 * Ordem de leitura: resumo (a resposta curta), grafico (a forma), lista (os
 * numeros exatos e a porta para cada mes). A definicao das metricas fica no
 * fim, sempre visivel — os rotulos daqui sao diferentes dos do Dashboard de
 * proposito, e a diferenca precisa estar explicada na propria tela.
 *
 * O tamanho da janela mora na URL (`?meses=12`), como o mes nas outras telas:
 * recarregar mantem a escolha.
 */
export function HistoryView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const size = resolveWindowParam(searchParams.get(WINDOW_PARAM));

  const { query, createdSinceMount } = useHistory(size);
  const { data, isPending, isError, refetch } = query;

  function changeSize(next: HistoryWindowSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(WINDOW_PARAM, String(next));
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
  }

  return (
    <div className="grid gap-4">
      <WindowToggle value={size} onChange={changeSize} />

      <PreparedNotice count={createdSinceMount} />

      {isPending ? (
        <HistorySkeleton />
      ) : isError || data === undefined ? (
        <HistoryError onRetry={() => void refetch()} />
      ) : data.monthsWithData === 0 ? (
        <HistoryEmpty size={size} />
      ) : (
        <>
          <HistorySummary summary={data.summary} />
          <HistoryChart months={data.months} />
          <MonthList months={data.months} />
          <Definitions />
        </>
      )}
    </div>
  );
}

function Definitions() {
  return (
    <section className="text-muted-foreground px-1 text-xs leading-relaxed">
      <p>
        <strong className="text-foreground font-medium">Renda gerada</strong> não inclui dinheiro
        vindo da reserva ou de outra conta sua.{' '}
        <strong className="text-foreground font-medium">Gastos operacionais</strong> não incluem o
        que você guardou. <strong className="text-foreground font-medium">Resultado</strong> é a
        renda gerada menos os gastos operacionais.
      </p>
      <p className="mt-2">
        Médias e melhor/pior mês consideram só meses encerrados com lançamentos seus. O mês em
        andamento fica de fora.
      </p>
    </section>
  );
}
