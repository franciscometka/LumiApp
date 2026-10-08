'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { CreateTransactionSheet, currentMonthKey } from '@/features/transactions/create-transaction-sheet';
import { useSelectedMonth } from '@/features/period/use-selected-month';
import { useUiStore } from '@/stores/ui-store';

/**
 * Botao flutuante de nova transacao.
 *
 * Mora no slot central da tab bar (que ja respeita a area segura) e sobe
 * acima dela. A centralizacao e estrutural: o slot e a coluna do meio de um
 * grid de cinco colunas iguais, e o botao se centra no slot. E a acao mais
 * frequente do app, entao fica no alcance do polegar.
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
      className="bg-primary text-primary-foreground ring-background focus-visible:ring-ring absolute inset-x-0 bottom-5 z-10 mx-auto grid size-14 place-items-center rounded-full shadow-lg ring-4 transition-transform active:scale-95 focus-visible:ring-2 lg:hidden"
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
