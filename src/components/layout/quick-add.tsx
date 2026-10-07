'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { CreateTransactionSheet, currentMonthKey } from '@/features/transactions/create-transaction-sheet';
import { useSelectedMonth } from '@/features/period/use-selected-month';
import { useUiStore } from '@/stores/ui-store';

/**
 * Botao flutuante de nova transacao.
 *
 * Pousa sobre o vao central da tab bar e sobe junto com a area segura. E a
 * acao mais frequente do app, entao fica no alcance do polegar e nao disputa
 * espaco com a navegacao.
 *
 * So existe no mobile: no desktop a mesma acao e um botao solido no topo da
 * sidebar, onde ha espaco para o rotulo.
 */
export function QuickAddFab() {
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  return (
    <button
      type="button"
      onClick={openQuickAdd}
      aria-label="Nova transação"
      className="bg-primary text-primary-foreground ring-background focus-visible:ring-ring fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-50 grid size-14 -translate-x-1/2 place-items-center rounded-full shadow-lg ring-4 transition-transform active:scale-95 focus-visible:ring-2 lg:hidden"
    >
      <Plus className="size-6" strokeWidth={2.4} />
    </button>
  );
}

/**
 * Sheet de criacao, montada na casca para funcionar em qualquer tela.
 *
 * O limite de Suspense existe porque `useSelectedMonth` le `useSearchParams`:
 * sem ele, a leitura da query string arrastaria toda a casca para
 * renderizacao dinamica. O fallback nao desenha nada — a sheet comeca fechada,
 * e o mes corrente e um padrao correto para o instante antes da hidratacao.
 */
export function QuickAddSheet() {
  return (
    <Suspense fallback={<CreateTransactionSheet month={currentMonthKey()} />}>
      <MonthAwareQuickAdd />
    </Suspense>
  );
}

function MonthAwareQuickAdd() {
  const { month } = useSelectedMonth();
  return <CreateTransactionSheet month={month} />;
}
