import { ComingSoon, PageShell } from '@/components/layout/page-shell';

export default function PlanejamentoPage() {
  return (
    <PageShell
      title="Planejamento"
      description="Renda esperada, limite de gastos e meta de economia."
    >
      <ComingSoon lote="Lote 8" />
    </PageShell>
  );
}
