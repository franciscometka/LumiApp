'use client';

import { civilMonthResolver } from '@/domain/shared/period';
import type { MonthKey, PlainDate } from '@/domain/shared/plain-date';
import { firstDayOfMonth, monthKeyOf, todayPlainDate } from '@/domain/shared/plain-date';
import { useUiStore } from '@/stores/ui-store';

import { TransactionSheet } from './components/transaction-sheet';
import type { TransactionFormValues } from './transaction-form';
import { validateForm } from './transaction-form';
import { useCreateTransaction } from './use-transaction-mutations';
import { useCategories } from './use-transactions';

/**
 * Criacao de lancamento, disponivel em qualquer tela pelo FAB.
 *
 * Vive na casca do app, nao na pagina de transacoes: o botao mais usado do
 * aplicativo nao pode exigir que a pessoa navegue primeiro. Reaproveita a
 * MESMA `TransactionSheet` da edicao — a unica diferenca e nao receber
 * `transaction` e chamar outra mutation.
 */
export function CreateTransactionSheet({ month }: { month: MonthKey }) {
  const isOpen = useUiStore((state) => state.isQuickAddOpen);
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen);

  const categoriesQuery = useCategories();
  const createTransaction = useCreateTransaction();

  const handleSubmit = async (values: TransactionFormValues) => {
    const result = validateForm(values, categoriesQuery.data ?? []);
    if (!result.ok) return;

    // `mutateAsync` e nao `mutate`: a sheet so pode fechar depois que a
    // escrita confirmar. Fechar antes seria fingir sucesso.
    await createTransaction.mutateAsync(result.draft);
    setQuickAddOpen(false);
    createTransaction.reset();
  };

  // Montada so quando aberta: ver a nota em `TransactionSheet`.
  if (!isOpen) return null;

  return (
    <TransactionSheet
      open
      onOpenChange={(open) => {
        setQuickAddOpen(open);
        if (!open) createTransaction.reset();
      }}
      categories={categoriesQuery.data ?? []}
      isSaving={createTransaction.isPending}
      saveError={createTransaction.error}
      onSubmit={handleSubmit}
      defaultDate={defaultDateFor(month)}
    />
  );
}

/**
 * Data inicial do formulario.
 *
 * O briefing pede "hoje", e hoje e o padrao sempre que o mes visto e o mes
 * corrente — o caso comum. Mas criar um lancamento datado de hoje enquanto se
 * navega setembro produziria um registro que simplesmente nao aparece na
 * lista: salvo com sucesso, invisivel na tela, sem nada explicando por que.
 *
 * Fora do mes corrente, a data ancora no primeiro dia do mes que a pessoa
 * esta olhando. Ela continua podendo trocar; o que muda e o palpite inicial
 * nao contradizer o contexto.
 */
export function defaultDateFor(month: MonthKey, today: PlainDate = todayPlainDate()): PlainDate {
  return monthKeyOf(today) === month ? today : firstDayOfMonth(month);
}

/** Mes corrente, para quando a tela nao informa um. */
export function currentMonthKey(): MonthKey {
  return civilMonthResolver.keyOf(todayPlainDate());
}
