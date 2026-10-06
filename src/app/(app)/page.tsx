import { ComingSoon, PageShell } from '@/components/layout/page-shell';

export default function HomePage() {
  return (
    <PageShell
      title="Início"
      description="Saldo, gastos e contas pendentes do mês selecionado."
    >
      <ComingSoon lote="Lote 4" />
    </PageShell>
  );
}
