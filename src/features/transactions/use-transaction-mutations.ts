'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { Transaction, TransactionStatus } from '@/domain/entities/transaction';
import type { ID } from '@/domain/shared/id';
import { monthKeyOf } from '@/domain/shared/plain-date';

import { useDataSource } from '../app/data-source-context';

import { invalidateMonth, invalidateMonths } from './invalidation';
import type { TransactionDraft } from './transaction-form';

/**
 * Mutations da feature.
 *
 * Duas regras valem para todas:
 *
 * - **a invalidacao e dirigida** (ver `invalidation.ts`), nunca global;
 * - **nada acontece na tela antes da persistencia confirmar.** Sem update
 *   otimista aqui: se o storage recusar a escrita, uma lista que ja mostrou o
 *   lancamento teria de desfazer sozinha, e o usuario veria o proprio dinheiro
 *   piscando. A gravacao local e rapida o bastante para esperar.
 *
 * `userId` vem das configuracoes, nao de uma constante: e o mesmo campo que o
 * Supabase vai preencher a partir da sessao autenticada.
 */

export function useCreateTransaction() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, TransactionDraft>({
    mutationFn: async (draft) => {
      const settings = await dataSource.settings.get();
      return dataSource.transactions.create({ ...draft, userId: settings.userId });
    },
    onSuccess: async (transaction) => {
      await invalidateMonth(queryClient, monthKeyOf(transaction.date));
    },
  });
}

export interface UpdateTransactionVariables {
  readonly id: ID;
  readonly draft: TransactionDraft;
  /**
   * A data ANTES da edicao. Sem ela nao e possivel saber qual mes perdeu o
   * lancamento quando a data muda de setembro para outubro — e o mes antigo
   * continuaria exibindo uma transacao que nao esta mais la.
   */
  readonly previousDate: Transaction['date'];
}

export function useUpdateTransaction() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, UpdateTransactionVariables>({
    mutationFn: ({ id, draft }) =>
      dataSource.transactions.update(id, {
        ...draft,
        // Campos opcionais precisam ser limpos EXPLICITAMENTE: um `patch` que
        // apenas omite `notes` deixaria a observacao antiga no registro.
        cardId: draft.cardId,
        debtId: draft.debtId,
        notes: draft.notes,
      }),
    onSuccess: async (transaction, variables) => {
      await invalidateMonths(queryClient, [
        monthKeyOf(variables.previousDate),
        monthKeyOf(transaction.date),
      ]);
    },
  });
}

/** Alternar pago/pendente e uma edicao de um campo so, com o mesmo cuidado. */
export function useSetTransactionStatus() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, { id: ID; status: TransactionStatus }>({
    mutationFn: ({ id, status }) => dataSource.transactions.update(id, { status }),
    onSuccess: async (transaction) => {
      await invalidateMonth(queryClient, monthKeyOf(transaction.date));
    },
  });
}

/**
 * Exclusao logica: marca `deletedAt`, nao remove a linha. E a semantica que o
 * repositorio ja tinha, e e o que torna o "Desfazer" possivel sem reconstruir
 * o registro a partir da tela.
 */
export function useDeleteTransaction() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Transaction>({
    mutationFn: (transaction) => dataSource.transactions.remove(transaction.id),
    onSuccess: async (_result, transaction) => {
      await invalidateMonth(queryClient, monthKeyOf(transaction.date));
    },
  });
}

/** Desfaz a exclusao logica. Sustenta o "Desfazer" do aviso. */
export function useRestoreTransaction() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Transaction, Error, Transaction>({
    mutationFn: (transaction) => dataSource.transactions.restore(transaction.id),
    onSuccess: async (transaction) => {
      await invalidateMonth(queryClient, monthKeyOf(transaction.date));
    },
  });
}
