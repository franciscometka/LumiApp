import { create } from 'zustand';

/**
 * Estado de interface. SOMENTE interface.
 *
 * Regra que esta loja existe para respeitar: nenhuma entidade financeira
 * mora aqui. Transacoes, cartoes, dividas, planos e configuracoes vivem no
 * cache do TanStack Query, que e alimentado pelos repositorios. Duplicar
 * qualquer um deles criaria duas verdades, e a divergencia entre elas seria
 * um bug silencioso em cima de dinheiro.
 *
 * O mes selecionado tambem nao esta aqui: ele e estado de navegacao e vive
 * na URL (ver `useSelectedMonth`).
 *
 * O que cabe nesta loja: o que e efemero, local a sessao e irrelevante se
 * perdido num refresh.
 */
export interface UiState {
  /** Sheet de nova transacao. */
  readonly isQuickAddOpen: boolean;
  openQuickAdd(): void;
  closeQuickAdd(): void;
  setQuickAddOpen(open: boolean): void;

  /** Sidebar recolhida no desktop. */
  readonly isSidebarCollapsed: boolean;
  toggleSidebar(): void;
}

export const useUiStore = create<UiState>()((set) => ({
  isQuickAddOpen: false,
  openQuickAdd: () => {
    set({ isQuickAddOpen: true });
  },
  closeQuickAdd: () => {
    set({ isQuickAddOpen: false });
  },
  setQuickAddOpen: (open: boolean) => {
    set({ isQuickAddOpen: open });
  },

  isSidebarCollapsed: false,
  toggleSidebar: () => {
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
  },
}));
