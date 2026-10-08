'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ThemePreference, UserSettings } from '@/domain/entities/user-settings';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';

/**
 * Preferencias do usuario, lidas do banco.
 *
 * E a FONTE DE VERDADE do tema. O \`next-themes\` continua guardando uma copia
 * no proprio localStorage, mas so para pintar a primeira tela antes de o
 * banco abrir; depois disso \`ThemeSync\` o alinha com o que esta aqui.
 */
export function useSettings() {
  const dataSource = useDataSource();

  return useQuery<UserSettings>({
    queryKey: queryKeys.settings(),
    queryFn: () => dataSource.settings.get(),
    staleTime: 5 * 60 * 1000,
  });
}

export interface SettingsPatch {
  readonly salaryDay?: number;
  readonly theme?: ThemePreference;
}

/**
 * Grava uma ou mais preferencias.
 *
 * O dia do salario entra no snapshot (\`salaryRunway\`), entao a familia do
 * Dashboard cai junto. Tema nao muda numero nenhum: so a propria chave.
 */
export function useUpdateSettings() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<UserSettings, Error, SettingsPatch>({
    mutationFn: async (patch) => {
      const current = await dataSource.settings.get();
      return dataSource.settings.save({ ...current, ...patch });
    },
    onSuccess: async (saved, patch) => {
      queryClient.setQueryData(queryKeys.settings(), saved);
      if (patch.salaryDay !== undefined) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
      }
    },
  });
}

/**
 * Depois de importar um backup ou apagar os dados, o banco inteiro mudou.
 *
 * E o unico lugar do app que derruba TODAS as queries, e de proposito: cada
 * mes, cada lista, a materializacao (cujo cache nunca expira sozinho) e o
 * diagnostico descrevem um banco que deixou de existir. \`resetQueries\` volta
 * cada entrada ao estado inicial e recarrega as que estao na tela — nenhuma
 * mostra um numero do banco anterior.
 */
export function resetAllData(queryClient: QueryClient): Promise<void> {
  return queryClient.resetQueries({ queryKey: queryKeys.all });
}
