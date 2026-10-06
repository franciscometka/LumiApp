/**
 * Chaves de cache em um unico lugar.
 *
 * Montadas em arvore para que a invalidacao seja hierarquica: invalidar
 * `queryKeys.all` derruba tudo, `queryKeys.database()` derruba so o
 * diagnostico. Chaves escritas inline nos hooks sempre divergem com o tempo.
 *
 * Cresce lote a lote, conforme cada consulta real aparece.
 */
export const queryKeys = {
  all: ['finan'] as const,

  database: () => [...queryKeys.all, 'database'] as const,
  databaseStatus: () => [...queryKeys.database(), 'status'] as const,
} as const;
