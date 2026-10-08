import { Suspense } from 'react';

import { PageShell } from '@/components/layout/page-shell';
import { RecurringView } from '@/features/recurring/recurring-view';

export default function RecorrentesPage() {
  return (
    <PageShell
      title="Contas recorrentes"
      description="O que se repete todo mês, lançado sozinho."
    >
      <Suspense fallback={null}>
        <RecurringView />
      </Suspense>
    </PageShell>
  );
}
