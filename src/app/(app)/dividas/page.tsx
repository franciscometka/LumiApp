import { PageShell } from '@/components/layout/page-shell';
import { DebtsView } from '@/features/debts/debts-view';

export default function DividasPage() {
  return (
    <PageShell
      title="Dívidas e empréstimos"
      description="Quanto sai por mês e quanto falta para quitar."
    >
      <DebtsView />
    </PageShell>
  );
}
