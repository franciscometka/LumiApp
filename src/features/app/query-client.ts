import { QueryClient } from '@tanstack/react-query';

import { isDataError } from '@/data/ports/errors';

/**
 * Configuracao do cache de dados.
 *
 * A decisao que importa aqui e o `retry`: um `DataError` significa storage
 * corrompido, versao incompativel ou registro invalido. Nenhuma dessas
 * situacoes melhora sozinha, entao repetir a consulta so atrasa a tela de
 * erro que o usuario precisa ver. Falhas inesperadas continuam com uma
 * tentativa extra.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Os dados sao locais: releitura e barata, mas tambem desnecessaria
        // enquanto nada mudou. A invalidacao vem das mutations.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isDataError(error) && failureCount < 1,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
