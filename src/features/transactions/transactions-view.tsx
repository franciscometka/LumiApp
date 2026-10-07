'use client';

import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { countInGroups, groupByDay } from '@/domain/calculations/grouping';
import type { Transaction } from '@/domain/entities/transaction';
import { useUiStore } from '@/stores/ui-store';
import { todayPlainDate } from '@/domain/shared/plain-date';

import { useCards } from '../cards/use-cards';
import { useDebts } from '../debts/use-debts';
import { useSelectedMonth } from '../period/use-selected-month';

import { EmptyMonth, ListError, ListSkeleton, NoResults } from './components/list-states';
import { TransactionFilters } from './components/transaction-filters';
import { TransactionList } from './components/transaction-list';
import { TransactionSheet } from './components/transaction-sheet';
import type { ListFilters } from './list-filters';
import {
  EMPTY_FILTERS,
  applyListFilters,
  buildFilterQuery,
  filtersFromParams,
} from './list-filters';
import type { TransactionFormValues } from './transaction-form';
import { validateForm } from './transaction-form';
import {
  useDeleteTransaction,
  useRestoreTransaction,
  useSetTransactionStatus,
  useUpdateTransaction,
} from './use-transaction-mutations';
import { useCategories, useTransactions } from './use-transactions';

/**
 * Tela de transacoes.
 *
 * Responsabilidade unica: orquestrar. Nenhuma conta de dinheiro acontece aqui
 * — o agrupamento por dia e os totais vem de `groupByDay`, no dominio, e o
 * recorte vem de `applyListFilters`. O que este arquivo decide e o que
 * aparece, em que ordem, e qual mutation cada gesto dispara.
 */
export function TransactionsView() {
  const { month, label: monthLabel } = useSelectedMonth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  const today = useMemo(() => todayPlainDate(), []);

  const transactionsQuery = useTransactions(month);
  const categoriesQuery = useCategories();
  // Cartoes e dividas so alimentam os seletores de vinculo da sheet; a lista
  // nao depende deles para renderizar.
  const cardsQuery = useCards();
  const debtsQuery = useDebts();

  const updateTransaction = useUpdateTransaction();
  const setStatus = useSetTransactionStatus();
  const deleteTransaction = useDeleteTransaction();
  const restoreTransaction = useRestoreTransaction();

  /** Qual transacao esta sendo editada. `null` = sheet fechada. */
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  /** Ultima excluida, para o "Desfazer". */
  const [justDeleted, setJustDeleted] = useState<Transaction | null>(null);

  const filters = filtersFromParams(new URLSearchParams(searchParams.toString()));

  /**
   * Filtro na URL, nao em estado local: um link reproduz a tela inteira e o
   * botao Voltar desfaz o filtro, que e o que a pessoa espera dele.
   *
   * `replace` e nao `push`: cada tecla digitada na busca criaria uma entrada
   * no historico, e sair da tela exigiria pressionar Voltar trinta vezes.
   */
  const applyFilters = (next: ListFilters) => {
    const query = buildFilterQuery(new URLSearchParams(searchParams.toString()), next);
    router.replace((query === '' ? pathname : `${pathname}?${query}`) as Route, { scroll: false });
  };

  // O `?? []` precisa de memo proprio: um literal novo a cada render invalidaria
  // os memos abaixo sempre, anulando-os.
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const groups = useMemo(() => {
    const filtered = applyListFilters(
      transactions,
      filters,
      (id) => categoriesById.get(id)?.name ?? null,
    );
    return groupByDay(filtered);
  }, [transactions, filters, categoriesById]);

  const handleSave = async (values: TransactionFormValues) => {
    if (editing === null) return;

    const result = validateForm(values, categories);
    if (!result.ok) return;

    await updateTransaction.mutateAsync({
      id: editing.id,
      draft: result.draft,
      previousDate: editing.date,
    });
    setEditing(null);
    updateTransaction.reset();
  };

  const confirmDelete = async () => {
    if (pendingDelete === null) return;
    const target = pendingDelete;

    await deleteTransaction.mutateAsync(target);
    setPendingDelete(null);
    setEditing(null);
    // Exclusao logica: o registro continua la com `deletedAt`, entao desfazer
    // e restaurar, nao recriar — nenhum id muda e nenhum vinculo se perde.
    setJustDeleted(target);
  };

  if (transactionsQuery.isPending || categoriesQuery.isPending) {
    return <ListSkeleton />;
  }

  if (transactionsQuery.isError || categoriesQuery.isError) {
    return (
      <ListError
        onRetry={() => {
          void transactionsQuery.refetch();
          void categoriesQuery.refetch();
        }}
      />
    );
  }

  const total = countInGroups(groups);
  const monthIsEmpty = transactions.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Sem transacao nenhuma no mes, filtrar o vazio nao faz sentido. */}
      {monthIsEmpty ? null : (
        <TransactionFilters
          filters={filters}
          categories={categories}
          onChange={applyFilters}
          resultCount={total}
        />
      )}

      {monthIsEmpty ? (
        <EmptyMonth monthLabel={monthLabel} onCreate={openQuickAdd} />
      ) : total === 0 ? (
        <NoResults
          onClear={() => {
            applyFilters(EMPTY_FILTERS);
          }}
        />
      ) : (
        <TransactionList
          groups={groups}
          today={today}
          categoriesById={categoriesById}
          onSelect={setEditing}
          onToggleStatus={(transaction) => {
            setStatus.mutate({
              id: transaction.id,
              status: transaction.status === 'paid' ? 'pending' : 'paid',
            });
          }}
          pendingStatusId={setStatus.isPending ? (setStatus.variables?.id ?? null) : null}
        />
      )}

      {setStatus.isError ? (
        <p role="alert" className="bg-expense-surface text-expense rounded-lg px-4 py-3 text-sm">
          Não foi possível mudar a situação desse lançamento. Ele continua como estava.
        </p>
      ) : null}

      {justDeleted === null ? null : (
        <UndoDeleteNotice
          description={justDeleted.description}
          isPending={restoreTransaction.isPending}
          onUndo={() => {
            restoreTransaction.mutate(justDeleted, {
              onSuccess: () => {
                setJustDeleted(null);
              },
            });
          }}
          onDismiss={() => {
            setJustDeleted(null);
          }}
        />
      )}

      {/*
        A MESMA sheet da criacao, com `transaction` preenchido. Um formulario,
        duas mutations.

        Montada so durante a edicao: trocar de transacao desmonta e remonta,
        entao o formulario nunca exibe os dados da anterior.
      */}
      {editing === null ? null : (
        <TransactionSheet
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null);
              updateTransaction.reset();
            }
          }}
          transaction={editing}
          categories={categories}
          cards={cardsQuery.data ?? []}
          debts={debtsQuery.data ?? []}
          isSaving={updateTransaction.isPending}
          saveError={updateTransaction.error}
          onSubmit={handleSave}
          onRequestDelete={() => {
            setPendingDelete(editing);
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Excluir lançamento?"
        description={
          pendingDelete === null
            ? ''
            : `"${pendingDelete.description}" sai da lista e dos totais do mês. Você poderá desfazer em seguida.`
        }
        confirmLabel="Excluir"
        isPending={deleteTransaction.isPending}
        onConfirm={() => {
          void confirmDelete();
        }}
      />
    </div>
  );
}

/**
 * Desfazer depois de excluir.
 *
 * Barato de oferecer porque a exclusao e logica: `restore()` ja existia no
 * repositorio. E o que torna a confirmacao suportavel — a pessoa pode errar
 * sem perder nada.
 *
 * Nao desaparece sozinho por tempo: um aviso que some em 4 segundos e inutil
 * para quem le devagar, e cria pressa onde nao precisa haver.
 */
function UndoDeleteNotice({
  description,
  isPending,
  onUndo,
  onDismiss,
}: {
  description: string;
  isPending: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
    >
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="text-muted-foreground">Excluído: </span>
        {description}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" onClick={onUndo} disabled={isPending}>
          {isPending ? 'Restaurando' : 'Desfazer'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={isPending}>
          OK
        </Button>
      </div>
    </div>
  );
}
