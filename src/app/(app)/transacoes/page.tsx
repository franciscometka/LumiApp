import { ComingSoon, PageShell } from '@/components/layout/page-shell';

export default function TransacoesPage() {
  return (
    <PageShell
      title="Transações"
      description="Tudo que entrou e saiu, com busca e filtros."
    >
      <ComingSoon lote="Lote 5" />
    </PageShell>
  );
}
