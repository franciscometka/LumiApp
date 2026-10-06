'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import type { ReactNode } from 'react';

import { MonthSwitcher } from '@/components/finan/month-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { DataSourceProvider } from '@/features/app/data-source-context';
import { useBootState } from '@/features/app/data-source-store';
import { createQueryClient } from '@/features/app/query-client';

import { AppBootScreen, StorageErrorScreen } from './boot-screens';
import { DesktopSidebar } from './desktop-sidebar';
import { MobileTabBar } from './mobile-tab-bar';
import { QuickAddFab, QuickAddSheet } from './quick-add';

/**
 * Casca da aplicacao.
 *
 * A ordem aqui e a garantia central do lote: NADA que leia dados e montado
 * antes de `status === 'ready'`. O `DataSourceProvider` so existe nesse ramo,
 * entao uma query que tentasse rodar cedo demais encontraria o contexto vazio
 * e falharia alto, em desenvolvimento — em vez de silenciosamente ler um
 * armazenamento que ainda nao foi aberto.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // Um QueryClient por montagem da arvore, criado no inicializador do
  // `useState`: `new QueryClient()` direto no corpo criaria um cliente novo a
  // cada render e jogaria o cache fora junto.
  const [queryClient] = useState(createQueryClient);
  const boot = useBootState();

  if (boot.status === 'initializing') return <AppBootScreen />;
  if (boot.status === 'error') return <StorageErrorScreen error={boot.error} />;

  return (
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider dataSource={boot.dataSource}>
        <div className="flex min-h-dvh">
          <DesktopSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* O MonthSwitcher le a query string; `useSearchParams` exige um
                limite de Suspense para nao arrastar a arvore inteira para
                renderizacao dinamica. */}
            <Suspense fallback={<AppHeaderFallback />}>
              <AppHeader />
            </Suspense>

            <main className="flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-10">
              {children}
            </main>
          </div>

          <MobileTabBar />
          <QuickAddFab />
          <QuickAddSheet />
        </div>
      </DataSourceProvider>
    </QueryClientProvider>
  );
}

/**
 * Cabecalho fixo.
 *
 * O seletor de mes fica aqui, e nao dentro de cada pagina, porque o periodo
 * atravessa todas elas: trocar de mes em Transacoes e navegar para Cartoes
 * deve manter o mesmo recorte.
 */
function AppHeader() {
  return (
    <header className="bg-background/85 sticky top-0 z-30 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-2 px-4 lg:h-16 lg:px-8">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-[13px] font-semibold">
            F
          </div>
        </div>

        <MonthSwitcher className="lg:-ml-2" />

        <div className="lg:hidden">
          <ThemeToggle />
        </div>
        <div className="hidden lg:block lg:w-8" aria-hidden />
      </div>
    </header>
  );
}

function AppHeaderFallback() {
  return <div className="bg-background/85 sticky top-0 z-30 h-14 border-b lg:h-16" />;
}
