'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { MOBILE_TAB_DESTINATIONS, isDestinationActive, tabLabel } from './navigation';
import type { NavDestination } from './navigation';
import { QuickAddFab } from './quick-add';

/**
 * Barra inferior do mobile: `Inicio | Transacoes | (+) | Planos | Mais`.
 *
 * Cinco slots de largura igual (grid de 5 colunas), o do meio e do FAB. O
 * alinhamento e estrutural, nao de offsets: todos os destinos tem a mesma
 * anatomia (icone, gap, rotulo) e a mesma altura, entao icones caem na mesma
 * linha e rotulos na mesma baseline em qualquer largura; e o centro da coluna
 * do meio e o centro da viewport.
 *
 * Decisoes que fazem parecer nativo:
 * - fixa, com `env(safe-area-inset-bottom)` para nao ficar sob a barra de
 *   gestos do iPhone;
 * - alvos de toque de 56px de altura e ~72px de largura (a 360px);
 * - o item ativo muda cor E peso, nunca so cor — contraste nao pode ser a
 *   unica pista.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const { left, right } = MOBILE_TAB_DESTINATIONS;

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl lg:hidden"
    >
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {left.map((destination) => (
          <TabLink key={destination.href} destination={destination} pathname={pathname} />
        ))}
        <div className="relative h-14">
          <QuickAddFab />
        </div>
        {right.map((destination) => (
          <TabLink key={destination.href} destination={destination} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ destination, pathname }: { destination: NavDestination; pathname: string }) {
  const active = isDestinationActive(destination, pathname);
  const Icon = destination.icon;

  return (
    <Link
      href={destination.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-14 min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
      )}
    >
      <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.3 : 1.8} />
      <span
        className={cn(
          'max-w-full truncate text-[10px] leading-none tracking-tight',
          active && 'font-semibold',
        )}
      >
        {tabLabel(destination)}
      </span>
    </Link>
  );
}
