'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { MonthlyPlan } from '@/domain/entities/monthly-plan';
import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import { invalidatePlan } from '../transactions/invalidation';

import type { PlanDraft } from './plan-form';

/**
 * Plano do mes. `null` quando nao existe — e um estado real, nao um plano de
 * zeros.
 */
export function useMonthlyPlan(month: MonthKey) {
  const dataSource = useDataSource();

  return useQuery<MonthlyPlan | null>({
    queryKey: queryKeys.monthlyPlan(month),
    queryFn: () => dataSource.monthlyPlans.findByMonth(month),
  });
}

/**
 * Plano do mes ANTERIOR, usado apenas para oferecer "usar valores de X".
 *
 * Le um `MonthlyPlan`, nunca transacoes — por isso nao encosta na pendencia
 * de materializacao do mes anterior registrada no Lote 7. Nenhum calculo de
 * progresso depende deste dado.
 */
export function usePreviousMonthPlan(month: MonthKey) {
  const dataSource = useDataSource();
  const previous = civilMonthResolver.previous(month);

  return useQuery<MonthlyPlan | null>({
    queryKey: queryKeys.monthlyPlan(previous),
    queryFn: () => dataSource.monthlyPlans.findByMonth(previous),
  });
}

export function useCreatePlan() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<MonthlyPlan, Error, { month: MonthKey; draft: PlanDraft }>({
    mutationFn: async ({ month, draft }) => {
      const settings = await dataSource.settings.get();
      return dataSource.monthlyPlans.create({ ...draft, month, userId: settings.userId });
    },
    onSuccess: async (plan) => {
      await invalidatePlan(queryClient, plan.month);
    },
  });
}

/**
 * Editar o plano NAO toca em transacao nenhuma.
 *
 * O plano e uma referencia; as transacoes sao fatos. Os dois so se encontram
 * em `buildPlanProgress`, que le ambos e nao escreve em nenhum. Por isso esta
 * mutation invalida o snapshot (o progresso mudou) mas nunca a lista de
 * transacoes (elas nao mudaram).
 */
export function useUpdatePlan() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<MonthlyPlan, Error, { id: string; month: MonthKey; draft: PlanDraft }>({
    mutationFn: ({ id, draft }) => dataSource.monthlyPlans.update(id, draft),
    onSuccess: async (plan) => {
      await invalidatePlan(queryClient, plan.month);
    },
  });
}

/**
 * Remover o planejamento.
 *
 * Exclusao logica, como todo o resto do app. Nao altera transacao, recorrencia,
 * cartao, divida nem qualquer dado financeiro: o mes continua exatamente como
 * estava, apenas sem meta declarada. A tela volta a oferecer "criar".
 */
export function useDeletePlan() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<void, Error, MonthlyPlan>({
    mutationFn: (plan) => dataSource.monthlyPlans.remove(plan.id),
    onSuccess: async (_result, plan) => {
      await invalidatePlan(queryClient, plan.month);
    },
  });
}
