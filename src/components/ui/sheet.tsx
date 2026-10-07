'use client';

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/**
 * Painel deslizante. No mobile sobe de baixo, que e onde o polegar alcanca;
 * no desktop vem da direita.
 */

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({ className, ...props }: ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = 'bottom',
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & {
  side?: 'bottom' | 'right' | 'responsive';
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'bg-card fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:duration-300 data-[state=closed]:duration-200',
          side === 'bottom' &&
            cn(
              'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t p-5',
              'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
              'data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            ),
          /**
           * Painel que sobe no celular e vira modal centrado no desktop.
           *
           * E a mesma arvore nos dois tamanhos — o formulario de transacao
           * nao pode existir em duas versoes, cada uma com seu proprio bug.
           * Trocar de componente por media query duplicaria o estado; trocar
           * de classes nao.
           */
          side === 'responsive' &&
            cn(
              'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-2xl border-t p-5',
              'pb-[max(1.25rem,env(safe-area-inset-bottom))]',
              'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2',
              'sm:w-[28rem] sm:max-w-[calc(100vw-2rem)] sm:max-h-[86dvh]',
              'sm:-translate-x-1/2 sm:-translate-y-1/2',
              'sm:rounded-2xl sm:border sm:p-6',
            ),
          side === 'right' &&
            cn(
              'inset-y-0 right-0 h-full w-full max-w-sm border-l p-6',
              'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            ),
          className,
        )}
        {...props}
      >
        {side === 'bottom' || side === 'responsive' ? (
          <div
            aria-hidden
            className={cn(
              'bg-border mx-auto h-1 w-10 shrink-0 rounded-full',
              // No modo responsivo o painel deixa de ser gaveta no desktop, e
              // uma alca de arrastar ali passaria a nao significar nada.
              side === 'responsive' && 'sm:hidden',
            )}
          />
        ) : null}

        {children}

        <SheetPrimitive.Close
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5', className)} {...props} />;
}

function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('text-lg font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm leading-relaxed', className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
