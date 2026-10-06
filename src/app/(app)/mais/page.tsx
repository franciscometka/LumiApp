import { PageShell } from '@/components/layout/page-shell';
import { PersistenceStatusCard } from '@/features/app/persistence-status-card';

const UPCOMING = [
  { label: 'Dívidas e empréstimos', lote: 'Lote 6' },
  { label: 'Contas recorrentes', lote: 'Lote 7' },
  { label: 'Categorias', lote: 'Lote 5' },
  { label: 'Histórico', lote: 'Lote 10' },
  { label: 'Ajustes', lote: 'Lote 11' },
];

/**
 * Server Component que monta uma unica ilha cliente.
 *
 * A lista e estatica e nao precisa de JavaScript no navegador; so o cartao de
 * diagnostico consulta dados, e so ele atravessa a fronteira.
 */
export default function MaisPage() {
  return (
    <PageShell title="Mais" description="Dívidas, recorrentes, histórico e ajustes.">
      <div className="grid gap-4">
        <PersistenceStatusCard />

        <section className="bg-card rounded-xl border">
          <h2 className="text-muted-foreground border-b px-5 py-3 text-xs font-medium tracking-wide uppercase">
            Em construção
          </h2>
          <ul className="divide-y">
            {UPCOMING.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-4 px-5 py-3.5 text-sm"
              >
                <span>{item.label}</span>
                <span className="text-muted-foreground text-xs">{item.lote}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
