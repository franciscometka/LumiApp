'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

import { PRIMARY_DESTINATIONS, isDestinationActive } from './navigation';

/**
 * Sidebar do desktop.
 *
 * Discreta de proposito: sem badges, sem contadores, sem secoes recolhiveis.
 * O desktop ganha espaco para o conteudo respirar, nao para virar painel
 * corporativo — e o briefing pediu exatamente o contrario disso.
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  return (
    <aside className="bg-background hidden w-60 shrink-0 flex-col border-r lg:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg text-[15px] font-semibold">
          F
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Finan</span>
      </div>

      <div className="px-3 pb-3">
        <Button onClick={openQuickAdd} className="w-full justify-start gap-2">
          <Plus />
          Nova transação
        </Button>
      </div>

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col gap-0.5 px-3">
        {PRIMARY_DESTINATIONS.map((destination) => {
          const active = isDestinationActive(destination, pathname);
          const Icon = destination.icon;

          return (
            <Link
              key={destination.href}
              href={destination.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              {destination.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-3 py-4">
        <span className="text-muted-foreground px-2 text-xs">Finan</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
