import Link from 'next/link';
import { ChevronRight, CreditCard, HandCoins, History, Repeat, Settings } from 'lucide-react';

import { PageShell } from '@/components/layout/page-shell';
import { cn } from '@/lib/utils';
import { PersistenceStatusCard } from '@/features/app/persistence-status-card';

/**
 * Telas que nao cabem na navegacao principal do celular.
 *
 * Cartoes abre a lista so no celular: ali ele saiu da tab bar (cinco slots,
 * o do meio e do FAB) e mora aqui. No desktop ele ja e item da sidebar, entao
 * some daqui (`lg:hidden`, o mesmo breakpoint em que a sidebar aparece).
 */
const SECTIONS = [
  {
    label: 'Cartões',
    description: 'Faturas, limites e vencimentos.',
    href: '/cartoes' as const,
    icon: CreditCard,
    mobileOnly: true,
  },
  {
    label: 'Dívidas e empréstimos',
    description: 'Parcelas, progresso e quanto falta.',
    href: '/dividas' as const,
    icon: HandCoins,
  },
  {
    label: 'Contas recorrentes',
    description: 'O que se repete todo mês.',
    href: '/recorrentes' as const,
    icon: Repeat,
  },
  {
    label: 'Histórico',
    description: 'Seus meses lado a lado.',
    href: '/historico' as const,
    icon: History,
  },
  {
    label: 'Ajustes',
    description: 'Preferências e backup dos seus dados.',
    href: '/ajustes' as const,
    icon: Settings,
  },
];

/**
 * Server Component que monta uma unica ilha cliente.
 *
 * A lista e estatica e nao precisa de JavaScript no navegador; so o cartao de
 * diagnostico consulta dados, e so ele atravessa a fronteira.
 */
export default function MaisPage() {
  return (
    <PageShell title="Mais" description="Tudo o que não está na navegação principal.">
      <div className="grid gap-4">
        <nav className="bg-card overflow-hidden rounded-xl border">
          <ul className="divide-y">
            {SECTIONS.map((section) => (
              <li key={section.href} className={cn('mobileOnly' in section && 'lg:hidden')}>
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
      </div>
    </PageShell>
  );
}
