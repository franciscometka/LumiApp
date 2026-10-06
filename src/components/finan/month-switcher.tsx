'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useSelectedMonth } from '@/features/period/use-selected-month';
import { cn } from '@/lib/utils';

/**
 * Seletor de periodo. Le e escreve o mes na URL.
 *
 * O rotulo e um botao: tocar nele volta ao mes corrente. E o atalho que se
 * procura depois de navegar tres meses para tras, e evita gastar espaco com
 * um botao "hoje" separado.
 */
export function MonthSwitcher({ className }: { className?: string }) {
  const { label, isCurrent, goToPrevious, goToNext, goToCurrent } = useSelectedMonth();

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <button
        type="button"
        onClick={goToPrevious}
        aria-label="Mês anterior"
        className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring grid size-8 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronLeft className="size-4" />
      </button>

      <button
        type="button"
        onClick={goToCurrent}
        disabled={isCurrent}
        aria-label={isCurrent ? undefined : `${label}. Voltar para o mês atual`}
        className={cn(
          // `capitalize` do Tailwind maiusculiza TODA palavra e produziria
          // "Outubro De 2026". O Intl ja entrega "outubro de 2026"; so a
          // primeira letra precisa subir.
          'min-w-[8.5rem] rounded-md px-2 py-1 text-center text-[13px] font-medium transition-colors first-letter:uppercase',
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          isCurrent ? 'cursor-default' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        )}
      >
        {label}
      </button>

      <button
        type="button"
        onClick={goToNext}
        aria-label="Próximo mês"
        className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring grid size-8 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
