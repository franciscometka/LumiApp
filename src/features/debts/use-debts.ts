'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Debt } from '@/domain/entities/debt';
import type { ID } from '@/domain/shared/id';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import { invalidateDebts } from '../transactions/invalidation';

import type { DebtDraft } from './debt-form';

/** Inclui as excluidas, pelo mesmo motivo dos cartoes: resolver o nome de um
 *  vinculo historico em vez de exibir um id orfao. */
export function useDebts() {
  const dataSource = useDataSource();

  return useQuery<Debt[]>({
    queryKey: queryKeys.debts(),
    queryFn: () => dataSource.debts.findAll({ includeDeleted: true }),
    staleTime: 60 * 1000,
  });
}

export function useCreateDebt() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Debt, Error, DebtDraft>({
    mutationFn: async (draft) => {
      const settings = await dataSource.settings.get();
      return dataSource.debts.create({ ...draft, userId: settings.userId });
    },
    onSuccess: async () => {
      await invalidateDebts(queryClient);
    },
  });
}

/**
 * O patch limpa EXPLICITAMENTE os campos de prazo.
 *
 * Se a pessoa desmarcar "sei o prazo", omitir os campos do patch deixaria o
 * cronograma antigo gravado, e a tela continuaria exibindo um progresso que
 * ela acabou de dizer que nao conhece.
 */
export function useUpdateDebt() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Debt, Error, { id: ID; draft: DebtDraft }>({
    mutationFn: ({ id, draft }) =>
      dataSource.debts.update(id, {
        ...draft,
        totalInstallments: draft.totalInstallments,
        paidInstallments: draft.paidInstallments,
        startDate: draft.startDate,
        notes: draft.notes,
      }),
    onSuccess: async () => {
      await invalidateDebts(queryClient);
    },
  });
}

/**
 * Avanco de parcela — e SOMENTE isso.
 *
 * Nao cria transacao. Decisao explicita do lote: `paidInstallments` e a unica
 * fonte de verdade do progresso, e uma transacao com `debtId` significa
 * "este lancamento se relaciona a esta divida", nunca "avance o contador".
 * Duas fontes tentando sincronizar uma a outra divergem no primeiro caso de
 * borda — exclusao, edicao de data, reversao.
 *
 * Um caso de uso `recordDebtPayment` que faca as duas coisas de forma atomica
 * e possivel no futuro; exige tratar criacao, edicao, exclusao e reversao como
 * uma operacao so, o que este lote nao cobre.
 */
export function useSetPaidInstallments() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Debt, Error, { id: ID; paidInstallments: number }>({
    mutationFn: ({ id, paidInstallments }) => dataSource.debts.update(id, { paidInstallments }),
    onSuccess: async () => {
      await invalidateDebts(queryClient);
    },
  });
}

/** Exclusao logica. Sem cascade: transacoes com `debtId` permanecem intactas. */
export function useDeleteDebt() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Debt>({
    mutationFn: (debt) => dataSource.debts.remove(debt.id),
    onSuccess: async () => {
      await invalidateDebts(queryClient);
    },
  });
}

export function useRestoreDebt() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Debt, Error, Debt>({
    mutationFn: (debt) => dataSource.debts.restore(debt.id),
    onSuccess: async () => {
      await invalidateDebts(queryClient);
    },
  });
}
