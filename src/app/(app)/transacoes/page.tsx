import { Suspense } from 'react';

import { PageShell } from '@/components/layout/page-shell';
import { ListSkeleton } from '@/features/transactions/components/list-states';
import { TransactionsView } from '@/features/transactions/transactions-view';

/**
 * Server Component fino.
 *
 * O limite de Suspense e obrigatorio: `TransactionsView` le o mes e os filtros
 * de `useSearchParams`, e sem ele a pagina inteira seria marcada como dinamica
 * na build.
 */
export default function TransacoesPage() {
  return (
    <PageShell title="Transações" description="Tudo que entrou e saiu, com busca e filtros.">
      <Suspense fallback={<ListSkeleton />}>
        <TransactionsView />
      </Suspense>
    </PageShell>
  );
}
