'use client';

import { useQuery } from '@tanstack/react-query';

import type { DataSource } from '@/data/ports/data-source';
import type { Category } from '@/domain/entities/category';
import type { Transaction } from '@/domain/entities/transaction';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';

/**
 * Lista do mes e categorias — as duas leituras que a tela de transacoes faz.
 *
 * Componentes nao conhecem repositorio: eles chamam estes hooks. O recorte por
 * periodo usa o mesmo `TransactionFilter` do dominio, entao o adapter Supabase
 * podera traduzi-lo para `WHERE` sem que a tela mude.
 */

export async function loadMonthTransactions(
  dataSource: DataSource,
  month: MonthKey,
): Promise<Transaction[]> {
  return dataSource.transactions.findByFilter({
    period: civilMonthResolver.resolve(month),
  });
}

export function useTransactions(month: MonthKey) {
  const dataSource = useDataSource();

  return useQuery<Transaction[]>({
    queryKey: queryKeys.transactionsByMonth(month),
    queryFn: () => loadMonthTransactions(dataSource, month),
  });
}

/**
 * Categorias reais do repositorio. O formulario nunca lista opcoes fixas no
 * codigo: categoria e dado do usuario, e uma lista hardcodada passaria a
 * mentir no instante em que ele criasse a primeira categoria propria.
 *
 * `staleTime` alto porque categorias quase nao mudam e o formulario abre e
 * fecha varias vezes seguidas.
 */
export function useCategories() {
  const dataSource = useDataSource();

  return useQuery<Category[]>({
    queryKey: queryKeys.categories(),
    queryFn: () => dataSource.categories.findAll(),
    staleTime: 5 * 60 * 1000,
  });
}
