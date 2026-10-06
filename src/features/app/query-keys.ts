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
} as const;
