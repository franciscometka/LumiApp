'use client';

import { useQuery } from '@tanstack/react-query';

import type { MonthKey } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import type { MaterializationResult } from '../recurring/materialize';
import { materializeMonth } from '../recurring/materialize';

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
 * ## Como duas telas compartilham UMA execucao
 *
 * A coordenacao e o proprio cache do TanStack Query. Dashboard e Transacoes
 * chamam `useMonthReady(month)` com a mesma chave; o Query deduplica
 * requisicoes identicas em voo, entao a materializacao roda UMA vez mesmo com
 * as duas telas montadas. Nao e preciso provider nem estado global novo — a
 * chave de cache ja e o ponto de encontro.
 *
 * `staleTime: Infinity` porque materializar o mesmo mes de novo na mesma
 * sessao nao tem o que acrescentar: o resultado seria sempre "nada a criar".
 *
 * ## Por que as queries financeiras esperam
 *
 * Elas usam `enabled: isReady`. Sem isso, a lista de transacoes leria o mes
 * antes das ocorrencias existirem e mostraria um mes incompleto por um
 * instante, para depois pular — e o pior: um Dashboard que calcula totais
 * sobre dados parciais exibe numeros errados, ainda que por pouco tempo.
 */
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

  const query = useQuery<MaterializationResult>({
    queryKey: queryKeys.materialization(month),
    queryFn: () => materializeMonth(dataSource, month),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    // Materializar e escrita: repetir ao focar a janela seria gravar por
    // causa de um alt-tab.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
  });

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
