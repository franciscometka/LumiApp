'use client';

import { useQuery } from '@tanstack/react-query';

import type { DatabaseStatus } from '@/data/ports/data-source';

import { useDataSource } from './data-source-context';
import { queryKeys } from './query-keys';

/**
 * Diagnostico da persistencia.
 *
 * Primeira consulta real do app, e deliberadamente esta: nao e dado
 * financeiro (isso e o lote 4), mas e o que o AppShell precisa para
 * distinguir "pronto" de "pronto com problema" — por exemplo, dados que
 * abriram mas trazem registros recusados.
 *
 * `useDataSource()` garante que isto so roda depois da inicializacao.
 */
export function useDatabaseStatus() {
  const dataSource = useDataSource();

  return useQuery<DatabaseStatus>({
    queryKey: queryKeys.databaseStatus(),
    queryFn: () => dataSource.maintenance.status(),
  });
}
