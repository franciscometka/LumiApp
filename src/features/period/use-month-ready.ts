'use client';

import type { QueryClient } from '@tanstack/react-query';
import { queryOptions, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import type { DataSource } from '@/data/ports/data-source';
import type { MonthKey } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import type { MaterializationResult } from '../recurring/materialize';
import { materializeMonth } from '../recurring/materialize';
import { invalidateMonth } from '../transactions/invalidation';

/**
 * ============================================================================
 * "Visitar um mes garante suas recorrencias."
 * ============================================================================
 *
 * Esta garantia e do PERIODO, nao de uma tela. Abrir `/transacoes?month=2026-10`
 * direto, sem passar pela Dashboard, precisa materializar outubro do mesmo
 * jeito — a regra de produto e sobre visitar o mes, nao sobre qual tela
 * carregou primeiro. Por isso o hook mora na feature de periodo, ao lado de
 * `useSelectedMonth`, e nao dentro de Dashboard ou de Transacoes.
 *
 * A ordem conceitual que ele impoe:
 *
 *     mes selecionado -> ensureMaterialized(mes) -> liberar queries do mes
 *
 * ## Uma infraestrutura, varios consumidores
 *
 * Existe UMA definicao de query de preparacao por mes
 * (`materializationQuery`), e todo consumidor passa por ela:
 *
 * - `useMonthReady(mes)` — Transacoes e o aviso do Dashboard;
 * - `usePeriodsReady([M-1, M])` — o snapshot do Dashboard, que compara com o
 *   mes anterior e por isso precisa dele completo;
 * - `usePeriodsReady(janela)` — o Historico.
 *
 * A coordenacao e o proprio cache do TanStack Query: a chave e
 * `materialization(mes)` em todos os casos, entao Dashboard, Transacoes e
 * Historico pedindo setembro compartilham UMA execucao. Nao ha um segundo
 * materializador para intervalos — um intervalo e so uma lista de meses.
 *
 * ## Por que as queries financeiras esperam
 *
 * Elas usam `enabled: isReady`. Sem isso, a lista de transacoes leria o mes
 * antes das ocorrencias existirem e mostraria um mes incompleto por um
 * instante, para depois pular — e o pior: um Dashboard que calcula totais
 * sobre dados parciais exibe numeros errados, ainda que por pouco tempo.
 *
 * ## Escrita separada da leitura
 *
 * A query de preparacao ESCREVE; as queries que exibem dados so LEEM. Elas
 * nunca se misturam numa mesma `queryFn`. Quando a preparacao cria algo, ela
 * mesma invalida as leituras daquele mes (`invalidateMonth`, que inclui o
 * Historico) — e isso que garante que uma leitura que correu em paralelo com
 * a escrita nao fique com o numero velho.
 */

export function materializationQuery(
  dataSource: DataSource,
  queryClient: QueryClient,
  month: MonthKey,
) {
  return queryOptions<MaterializationResult>({
    queryKey: queryKeys.materialization(month),
    queryFn: async () => {
      const result = await materializeMonth(dataSource, month);
      if (result.created > 0) {
        // Sem `await`: a preparacao termina quando a escrita termina. As
        // leituras do mes recarregam por conta propria.
        void invalidateMonth(queryClient, month);
      }
      return result;
    },
    /**
     * Nunca fica velha sozinha: materializar o mesmo mes de novo na mesma
     * sessao nao tem o que acrescentar. So uma invalidacao explicita (uma
     * recorrencia mudou) a torna velha.
     */
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    // Materializar e escrita: repetir ao focar a janela seria gravar por
    // causa de um alt-tab.
    refetchOnWindowFocus: false,
    /**
     * `true`, e nao `false`: com `staleTime` infinito, montar so reexecuta
     * quando a entrada foi INVALIDADA. Com `false`, criar uma recorrencia em
     * `/recorrentes` e voltar ao Dashboard nao lancava a ocorrencia do mes —
     * a query invalidada estava inativa e a montagem a ignorava ate recarregar
     * a pagina (bug do Lote 7, corrigido no Lote 9).
     */
    refetchOnMount: true,
    refetchOnReconnect: false,
    retry: false,
  });
}

export interface MonthReadyState {
  /** Se as queries financeiras daquele mes ja podem rodar. */
  readonly isReady: boolean;
  readonly isPreparing: boolean;
  /** Falha na materializacao. O mes ainda pode ser lido, sem as recorrencias. */
  readonly error: Error | null;
  /** O que foi criado agora, para o aviso discreto. `null` se nada foi. */
  readonly justCreated: MaterializationResult | null;
}

export function useMonthReady(month: MonthKey): MonthReadyState {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  const query = useQuery(materializationQuery(dataSource, queryClient, month));

  return {
    /**
     * Pronto tambem quando falhou.
     *
     * Se a materializacao quebrar, o mes continua legivel com o que ja existe.
     * Bloquear a leitura deixaria a pessoa sem acesso aos proprios
     * lancamentos por causa de uma conta recorrente que nao pode ser criada.
     */
    isReady: query.isSuccess || query.isError,
    isPreparing: query.isPending,
    error: query.error,
    justCreated: query.data !== undefined && query.data.created > 0 ? query.data : null,
  };
}

export interface PeriodsReadyState {
  /** Todos os meses prontos (ou falhos — ver `useMonthReady`). */
  readonly isReady: boolean;
  readonly isPreparing: boolean;
  readonly errors: readonly Error[];
  /**
   * Ocorrencias criadas DESDE que este consumidor montou. Um mes que outra
   * tela materializou antes ja foi anunciado la; repeti-lo aqui contaria a
   * mesma criacao duas vezes.
   */
  readonly createdSinceMount: number;
}

/**
 * Prepara varios meses — o intervalo do Historico, ou M-1 e M no Dashboard.
 *
 * Cada mes e a MESMA query de `useMonthReady`, com a mesma chave: preparar
 * maio-outubro no Historico e depois abrir o Dashboard de setembro nao
 * materializa setembro de novo.
 */
export function usePeriodsReady(months: readonly MonthKey[]): PeriodsReadyState {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();
  // Instante da montagem, para separar "criado agora" de "criado antes".
  const [mountedAt] = useState(() => Date.now());

  return useQueries({
    queries: months.map((month) => materializationQuery(dataSource, queryClient, month)),
    combine: (results) => ({
      isReady: results.every((result) => result.isSuccess || result.isError),
      isPreparing: results.some((result) => result.isPending),
      errors: results.flatMap((result) => (result.error === null ? [] : [result.error])),
      createdSinceMount: results.reduce(
        (total, result) =>
          result.data !== undefined && result.dataUpdatedAt >= mountedAt
            ? total + result.data.created
            : total,
        0,
      ),
    }),
  });
}
