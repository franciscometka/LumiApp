'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RecurringBill } from '@/domain/entities/recurring-bill';
import type { ID } from '@/domain/shared/id';
import type { MonthKey } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import { invalidateRecurring } from '../transactions/invalidation';

import type { RecurringDraft } from './recurring-form';

/** Inclui as excluidas, para resolver o nome de um vinculo historico. */
export function useRecurringBills() {
  const dataSource = useDataSource();

  return useQuery<RecurringBill[]>({
    queryKey: queryKeys.recurringBills(),
    queryFn: () => dataSource.recurringBills.findAll({ includeDeleted: true }),
    staleTime: 60 * 1000,
  });
}

export function useCreateRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<RecurringBill, Error, RecurringDraft>({
    mutationFn: async (draft) => {
      const settings = await dataSource.settings.get();
      return dataSource.recurringBills.create({ ...draft, userId: settings.userId });
    },
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}

/**
 * Editar NAO toca em ocorrencia nenhuma.
 *
 * A regra do lote: transacao materializada e registro historico. Mudar a
 * Internet de R$ 120 para R$ 150 deixa outubro em R$ 120 e so vale para os
 * meses que ainda nao geraram. Nao existe, aqui, nenhuma escrita em
 * `transactions` — e deliberado, nao esquecimento.
 *
 * `endMonth` entra no patch explicitamente para que limpar o campo (voltar a
 * "sem término") de fato apague o valor antigo em vez de mante-lo.
 */
export function useUpdateRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<RecurringBill, Error, { id: ID; draft: RecurringDraft }>({
    mutationFn: ({ id, draft }) =>
      dataSource.recurringBills.update(id, { ...draft, endMonth: draft.endMonth }),
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}

/**
 * Encerrar: marca o ultimo mes em que a conta ainda vale.
 *
 * Diferente de excluir. A recorrencia continua no cadastro, visivel e com todo
 * o historico; ela so para de gerar depois daquele mes. "Cancelei a Netflix em
 * marco" e um fato sobre a vida da pessoa, nao um erro de cadastro.
 */
export function useEndRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<RecurringBill, Error, { id: ID; endMonth: MonthKey }>({
    mutationFn: ({ id, endMonth }) => dataSource.recurringBills.update(id, { endMonth }),
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}

/** Reabre uma recorrencia encerrada, removendo o ultimo mes. */
export function useReopenRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<RecurringBill, Error, ID>({
    mutationFn: (id) => dataSource.recurringBills.update(id, { endMonth: undefined }),
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}

/**
 * Exclusao LOGICA, sem cascade.
 *
 * As ocorrencias ja geradas permanecem intactas, com `recurringBillId`
 * preservado — elas sao o historico financeiro da pessoa, nao um detalhe do
 * cadastro. A recorrencia excluida apenas para de gerar e some da lista.
 */
export function useDeleteRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<void, Error, RecurringBill>({
    mutationFn: (bill) => dataSource.recurringBills.remove(bill.id),
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}

export function useRestoreRecurringBill() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<RecurringBill, Error, RecurringBill>({
    mutationFn: (bill) => dataSource.recurringBills.restore(bill.id),
    onSuccess: async () => {
      await invalidateRecurring(queryClient);
    },
  });
}
