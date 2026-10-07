import { PageShell } from '@/components/layout/page-shell';
import { DashboardView } from '@/features/dashboard/dashboard-view';

/**
 * Server Component que monta uma unica ilha cliente.
 *
 * O titulo e estatico; so a Dashboard precisa de dados, e so ela atravessa a
 * fronteira para o navegador.
 */
export default function HomePage() {
  return (
    <PageShell title="Início" hideTitle>
      <DashboardView />
    </PageShell>
  );
}
