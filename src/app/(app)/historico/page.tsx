import { Suspense } from 'react';

import { PageShell } from '@/components/layout/page-shell';
import { HistoryView } from '@/features/history/history-view';

export default function HistoricoPage() {
  return (
    <PageShell title="Histórico" description="Como seus meses têm evoluído.">
      {/* `useSearchParams` (tamanho da janela) exige um limite de Suspense. */}
      <Suspense fallback={null}>
        <HistoryView />
      </Suspense>
    </PageShell>
  );
}
