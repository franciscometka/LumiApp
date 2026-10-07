/**
 * Chaves de cache em um unico lugar.
 *
 * Montadas em arvore para que a invalidacao seja hierarquica: invalidar
 * `queryKeys.all` derruba tudo, `queryKeys.database()` derruba so o
 * diagnostico. Chaves escritas inline nos hooks sempre divergem com o tempo.
 *
 * Cresce lote a lote, conforme cada consulta real aparece.
 */
import type { MonthKey } from '@/domain/shared/plain-date';

export const queryKeys = {
  all: ['finan'] as const,

  database: () => [...queryKeys.all, 'database'] as const,
  databaseStatus: () => [...queryKeys.database(), 'status'] as const,

  dashboard: () => [...queryKeys.all, 'dashboard'] as const,
  /**
   * O mes faz parte da chave: cada periodo e uma entrada de cache propria, e
   * voltar para um mes ja visitado reaproveita o resultado em vez de recarregar.
   */
  monthlySnapshot: (month: MonthKey) => [...queryKeys.dashboard(), 'snapshot', month] as const,

  transactions: () => [...queryKeys.all, 'transactions'] as const,
  /**
   * A chave tem o mes e so o mes.
   *
   * Busca, tipo, categoria e status NAO entram aqui de proposito: sao recortes
   * de uma lista que o cliente ja tem inteira na memoria. Coloca-los na chave
   * criaria uma entrada de cache por combinacao de filtro — dezenas de copias
   * dos mesmos registros, cada uma precisando ser invalidada depois de uma
   * edicao. Filtrar o resultado e mais barato e nunca fica fora de sincronia.
   */
  transactionsByMonth: (month: MonthKey) => [...queryKeys.transactions(), 'month', month] as const,

  /** Categorias mudam raramente e o formulario depende delas. */
  categories: () => [...queryKeys.all, 'categories'] as const,

  /**
   * Cartoes e dividas sao dados globais, nao mensais: um cartao nao pertence a
   * outubro. Por isso a chave nao tem mes, e alterar um deles nao invalida
   * nenhum snapshot — nenhuma metrica do Dashboard le essas entidades.
   */
  cards: () => [...queryKeys.all, 'cards'] as const,
  debts: () => [...queryKeys.all, 'debts'] as const,
} as const;
