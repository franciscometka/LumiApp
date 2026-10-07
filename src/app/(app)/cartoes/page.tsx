import { PageShell } from '@/components/layout/page-shell';
import { CardsView } from '@/features/cards/cards-view';

export default function CartoesPage() {
  return (
    <PageShell title="Cartões" description="Fatura, limite e vencimento de cada cartão.">
      <CardsView />
    </PageShell>
  );
}
