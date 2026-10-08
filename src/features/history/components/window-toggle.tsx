'use client';

import type { HistoryWindowSize } from '@/domain/calculations/history';
import { HISTORY_WINDOW_SIZES } from '@/domain/calculations/history';
import { cn } from '@/lib/utils';

/** 6 ou 12 meses. Sem intervalo arbitrario neste lote. */
export function WindowToggle({
  value,
  onChange,
}: {
  value: HistoryWindowSize;
  onChange: (size: HistoryWindowSize) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Período do histórico"
      className="bg-muted/60 grid grid-cols-2 gap-1 rounded-lg p-1 sm:w-64"
    >
      {HISTORY_WINDOW_SIZES.map((size) => {
        const selected = size === value;
        return (
          <button
            key={size}
            type="button"
            onClick={() => {
              onChange(size);
            }}
            aria-pressed={selected}
            className={cn(
              'min-h-9 rounded-md text-sm transition-colors',
              selected
                ? 'bg-card text-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {size} meses
          </button>
        );
      })}
    </div>
  );
}
