import { Suspense } from 'react';

import { PageShell } from '@/components/layout/page-shell';
import { PlanningView } from '@/features/planning/planning-view';

export default function PlanejamentoPage() {
  return (
    <PageShell
      title="Planejamento"
      description="Renda esperada, limite de gastos e meta de economia."
    >
      <Suspense fallback={null}>
        <PlanningView />
      </Suspense>
    </PageShell>
  );
}
