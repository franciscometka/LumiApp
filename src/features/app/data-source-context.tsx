'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import type { DataSource } from '@/data/ports/data-source';

/**
 * O `DataSource` so entra no contexto DEPOIS da inicializacao concluir.
 *
 * E essa a garantia de que nenhuma query dispara cedo demais: um hook de dados
 * chama `useDataSource()`, e enquanto o provider nao existir a chamada lanca
 * em vez de consultar um storage que ainda nao foi aberto. O erro aparece em
 * desenvolvimento, nao em producao como um dado faltando.
 */
const DataSourceContext = createContext<DataSource | null>(null);

export function DataSourceProvider({
  dataSource,
  children,
}: {
  dataSource: DataSource;
  children: ReactNode;
}) {
  return <DataSourceContext value={dataSource}>{children}</DataSourceContext>;
}

export function useDataSource(): DataSource {
  const dataSource = useContext(DataSourceContext);

  if (dataSource === null) {
    throw new Error(
      'useDataSource foi chamado fora do DataSourceProvider. ' +
        'Componentes que leem dados precisam estar abaixo do AppShell, que so os renderiza apos a inicializacao.',
    );
  }

  return dataSource;
}

/** Versao tolerante, para componentes que podem renderizar antes da carga. */
export function useOptionalDataSource(): DataSource | null {
  return useContext(DataSourceContext);
}
