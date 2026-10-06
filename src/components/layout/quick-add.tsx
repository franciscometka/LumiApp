'use client';

import { Plus } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
 * Placeholder do lote 3.
 *
 * O formulario real — com valor mascarado, categoria, data e status — chega no
 * lote 5, junto com as mutations. Aqui o objetivo e so provar que o caminho
 * FAB -> store de UI -> sheet funciona nos dois tamanhos de tela.
 */
export function QuickAddSheet() {
  const isOpen = useUiStore((state) => state.isQuickAddOpen);
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen);

  return (
    <Sheet open={isOpen} onOpenChange={setQuickAddOpen}>
      <SheetContent side="bottom" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nova transação</SheetTitle>
          <SheetDescription>
            O formulário de lançamento entra no Lote 5, junto com a tela de transações.
          </SheetDescription>
        </SheetHeader>

        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
          Em breve
        </div>
      </SheetContent>
    </Sheet>
  );
}
