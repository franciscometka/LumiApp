import Link from 'next/link';
import { ChevronRight, HandCoins } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { PersistenceStatusCard } from '@/features/app/persistence-status-card';

/** Telas que ja existem e nao cabem na navegacao principal. */
const SECTIONS = [
  {
    label: 'Dívidas e empréstimos',
    description: 'Parcelas, progresso e quanto falta.',
    href: '/dividas' as const,
    icon: HandCoins,
  },
];

/**
 * Cada item diz o lote em que chega. "Categorias" nao tem lote: gerenciar
 * categorias nunca foi especificado, e anunciar uma data inventada seria
 * prometer o que ninguem combinou.
 */
const UPCOMING = [
  { label: 'Contas recorrentes', when: 'Lote 7' },
  { label: 'Histórico', when: 'Lote 10' },
  { label: 'Ajustes', when: 'Lote 11' },
  { label: 'Categorias', when: 'Em breve' },
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
        <nav className="bg-card overflow-hidden rounded-xl border">
          <ul className="divide-y">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <Link
                  href={section.href}
                  className="hover:bg-accent/60 flex min-h-14 items-center gap-3 px-5 py-3 transition-colors"
                >
                  <section.icon aria-hidden className="text-muted-foreground size-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{section.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {section.description}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

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
                <span className="text-muted-foreground text-xs">{item.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
