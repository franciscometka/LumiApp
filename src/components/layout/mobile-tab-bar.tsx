'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import { PRIMARY_DESTINATIONS, isDestinationActive, tabLabel } from './navigation';

/**
 * Barra inferior do mobile.
 *
 * Decisoes que fazem parecer nativo:
 * - fixa, com `env(safe-area-inset-bottom)` para nao ficar sob a barra de
 *   gestos do iPhone;
 * - alvos de toque de 56px de altura;
 * - o item ativo muda cor E peso, nunca so cor — contraste nao pode ser a
 *   unica pista.
 *
 * O espaco central fica vazio de proposito: e onde o FAB pousa.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  const left = PRIMARY_DESTINATIONS.slice(0, 2);
  const right = PRIMARY_DESTINATIONS.slice(2);

  return (
    <nav
      aria-label="Navegação principal"
      className="bg-background/85 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl lg:hidden"
    >
      <div className="flex items-stretch pb-[env(safe-area-inset-bottom)]">
        {/* Os grupos crescem na proporcao do numero de itens (2 e 3), nao
            meio a meio: com flex-1 em ambos, os tres destinos da direita
            ficariam espremidos em metade da largura. */}
        <TabGroup destinations={left} pathname={pathname} className="flex-[2]" />
        <div aria-hidden className="w-14 shrink-0" />
        <TabGroup destinations={right} pathname={pathname} className="flex-[3]" />
      </div>
    </nav>
  );
}

function TabGroup({
  destinations,
  pathname,
  className,
}: {
  destinations: readonly (typeof PRIMARY_DESTINATIONS)[number][];
  pathname: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-stretch', className)}>
      {destinations.map((destination) => {
        const active = isDestinationActive(destination, pathname);
        const Icon = destination.icon;

        return (
          <Link
            key={destination.href}
            href={destination.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
            )}
          >
            <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} />
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
      })}
    </div>
  );
}
