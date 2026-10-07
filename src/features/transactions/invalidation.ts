import type { QueryClient } from '@tanstack/react-query';

import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';

import { queryKeys } from '../app/query-keys';

/**
 * Invalidacao dirigida: so o que pode ter mudado.
 *
 * `queryClient.invalidateQueries()` sem argumento derrubaria tambem o
 * diagnostico do storage e todos os meses visitados, recarregando o app
 * inteiro para corrigir um lancamento. Funciona, e e preguicoso.
 *
 * O detalhe que nao e obvio: alterar um mes afeta DOIS snapshots.
 *
 * `loadMonthlySnapshot(M)` busca as transacoes de M **e de M-1**, porque a
 * secao de comparacao ("13,6% a mais que no mês passado") precisa do mes
 * anterior. Logo, mexer em setembro muda o snapshot de setembro e tambem o de
 * outubro. Invalidar apenas o mes editado deixaria a comparacao de outubro
 * exibindo um numero obsoleto — sem erro na tela, so um dado errado.
 */
export function invalidateMonth(queryClient: QueryClient, month: MonthKey): Promise<void> {
  const next = civilMonthResolver.next(month);

  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactionsByMonth(month) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.monthlySnapshot(month) }),
    // O mes seguinte compara-se com este.
    queryClient.invalidateQueries({ queryKey: queryKeys.monthlySnapshot(next) }),
  ]).then(() => undefined);
}

/**
 * Para uma edicao que mudou a data de mes: os dois meses perdem validade, nos
 * dois tipos de consulta. Se a data ficou no mesmo mes, invalida um so.
 */
export function invalidateMonths(
  queryClient: QueryClient,
  months: readonly MonthKey[],
): Promise<void> {
  const unique = [...new Set(months)];
  return Promise.all(unique.map((month) => invalidateMonth(queryClient, month))).then(
    () => undefined,
  );
}
