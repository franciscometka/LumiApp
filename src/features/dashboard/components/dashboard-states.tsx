'use client';

import { RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';

/**
 * Estados que nao sao "dados normais".
 *
 * Cada um existe porque a alternativa seria pior: um esqueleto evita o salto
 * de layout, um mes vazio evita uma tela de zeros que parece defeito, e um
 * erro controlado evita a tela branca.
 */

/**
 * Esqueleto com a MESMA geometria do conteudo real.
 *
 * Caixas de altura arbitraria fariam a pagina saltar quando os dados
 * chegassem — o esqueleto existe justamente para evitar isso.
 */
export function DashboardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="bg-card rounded-2xl border px-5 py-6 lg:px-7 lg:py-8">
        <div className="bg-muted h-3 w-40 animate-pulse rounded" />
        <div className="bg-muted mt-3 h-11 w-52 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-3 w-60 animate-pulse rounded" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`bg-card rounded-xl border px-4 py-3.5 ${index === 2 ? 'col-span-2 lg:col-span-1' : ''}`}
          >
            <div className="bg-muted h-3 w-16 animate-pulse rounded" />
            <div className="bg-muted mt-2.5 h-6 w-24 animate-pulse rounded" />
          </div>
        ))}
      </div>

      <div className="bg-card h-28 animate-pulse rounded-xl border" />
      <div className="bg-card h-56 animate-pulse rounded-xl border" />
    </div>
  );
}

/**
 * Mes sem nenhum lancamento.
 *
 * Nao e erro nem carregamento: e um mes que ainda nao aconteceu ou nao foi
 * preenchido. Mostrar R$ 0,00 em cinco cards passaria a impressao de que algo
 * quebrou.
 */
export function EmptyMonth({
  monthLabel,
  isFuture,
}: {
  monthLabel: string;
  isFuture: boolean;
}) {
  const openQuickAdd = useUiStore((state) => state.openQuickAdd);

  return (
    <div className="bg-card rounded-2xl border px-5 py-12 text-center">
      <h2 className="text-lg font-semibold tracking-tight">
        Nada lançado em <span className="first-letter:uppercase">{monthLabel}</span>
      </h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        {isFuture
          ? 'Este mês ainda não começou. O que você lançar aqui aparece como previsto.'
          : 'Assim que houver entradas e gastos, o resumo do mês aparece aqui.'}
      </p>

      <Button onClick={openQuickAdd} className="mt-6">
        Lançar o primeiro
      </Button>
    </div>
  );
}

export function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-card rounded-2xl border px-5 py-10 text-center">
      <div className="bg-expense-surface text-expense mx-auto grid size-10 place-items-center rounded-lg">
        <TriangleAlert className="size-5" />
      </div>

      <h2 className="mt-4 text-base font-semibold tracking-tight">
        Não foi possível montar o resumo
      </h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        Seus dados continuam salvos. Isso costuma ser passageiro.
      </p>

      <Button variant="outline" onClick={onRetry} className="mt-6 gap-2">
        <RotateCcw />
        Tentar de novo
      </Button>
    </div>
  );
}
