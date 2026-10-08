'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Card } from '@/domain/entities/card';
import { cardNameConflictMessage, findCardNameConflict } from '@/domain/entities/card';
import type { ID } from '@/domain/shared/id';
import type { Money } from '@/domain/shared/money';

import { useDataSource } from '../app/data-source-context';
import { queryKeys } from '../app/query-keys';
import { invalidateCards } from '../transactions/invalidation';

import type { CardDraft } from './card-form';

/**
 * Cartoes, INCLUINDO os excluidos.
 *
 * Parece contraintuitivo, e e deliberado: uma transacao antiga pode apontar
 * para um cartao ja excluido, e a tela precisa poder dizer "Cartao removido"
 * em vez de mostrar um vinculo em branco. Sem os excluidos no cache, a
 * referencia viraria um id orfao sem nome.
 *
 * Quem precisa apenas das opcoes de novo vinculo usa `availableForLinking`,
 * que filtra excluidos e arquivados.
 */
export function useCards() {
  const dataSource = useDataSource();

  return useQuery<Card[]>({
    queryKey: queryKeys.cards(),
    queryFn: () => dataSource.cards.findAll({ includeDeleted: true }),
    staleTime: 60 * 1000,
  });
}

/**
 * O formulario ja barra nome repetido; esta checagem na gravacao cobre o que
 * ele nao ve — outra aba que criou o mesmo nome depois que a lista carregou.
 */
export class CardNameConflictError extends Error {
  constructor(existing: Card) {
    super(cardNameConflictMessage(existing));
    this.name = 'CardNameConflictError';
  }
}

async function assertUniqueName(
  dataSource: ReturnType<typeof useDataSource>,
  name: string,
  exceptId?: ID,
): Promise<void> {
  const conflict = findCardNameConflict(name, await dataSource.cards.findAll(), exceptId);
  if (conflict !== null) throw new CardNameConflictError(conflict);
}

export function useCreateCard() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Card, Error, CardDraft>({
    mutationFn: async (draft) => {
      await assertUniqueName(dataSource, draft.name);
      const settings = await dataSource.settings.get();
      return dataSource.cards.create({ ...draft, userId: settings.userId });
    },
    onSuccess: async () => {
      await invalidateCards(queryClient);
    },
  });
}

export function useUpdateCard() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Card, Error, { id: ID; draft: CardDraft }>({
    mutationFn: async ({ id, draft }) => {
      await assertUniqueName(dataSource, draft.name, id);
      return dataSource.cards.update(id, draft);
    },
    onSuccess: async () => {
      await invalidateCards(queryClient);
    },
  });
}

/**
 * Atualizacao so da fatura.
 *
 * Grava `invoiceUpdatedAt` junto: a tela mostra quando o numero foi informado
 * para que uma fatura de tres meses atras nao passe por atual. Um valor velho
 * sem data e pior do que nenhum valor.
 */
export function useUpdateInvoice() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Card, Error, { id: ID; invoiceCents: Money }>({
    mutationFn: ({ id, invoiceCents }) =>
      dataSource.cards.update(id, {
        currentInvoiceCents: invoiceCents,
        invoiceUpdatedAt: new Date().toISOString(),
      }),
    onSuccess: async () => {
      await invalidateCards(queryClient);
    },
  });
}

/**
 * Exclusao LOGICA.
 *
 * Nenhum cascade: as transacoes vinculadas permanecem intactas, com o
 * `cardId` preservado. O cartao apenas deixa de ser oferecido para novos
 * vinculos, e as referencias antigas passam a aparecer como "Cartao removido".
 * Apagar o historico financeiro de alguem porque um cadastro foi excluido
 * seria perda de dado, nao limpeza.
 */
export function useDeleteCard() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<void, Error, Card>({
    mutationFn: (card) => dataSource.cards.remove(card.id),
    onSuccess: async () => {
      await invalidateCards(queryClient);
    },
  });
}

/** Desfazer restaura APENAS o cartao — nada mais foi tocado na exclusao. */
export function useRestoreCard() {
  const dataSource = useDataSource();
  const queryClient = useQueryClient();

  return useMutation<Card, Error, Card>({
    mutationFn: (card) => dataSource.cards.restore(card.id),
    onSuccess: async () => {
      await invalidateCards(queryClient);
    },
  });
}
