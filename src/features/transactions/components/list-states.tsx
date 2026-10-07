'use client';

import { Plus, SearchX } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Os estados que nao sao "lista com itens".
 *
 * Cada um diz uma coisa diferente, porque sao situacoes diferentes: um mes sem
 * nada lancado pede um convite a lancar; uma busca sem resultado pede para
 * afrouxar o filtro, nao para criar transacao. Reaproveitar o mesmo texto nos
 * dois faria o app parecer sem noção do que esta acontecendo.
 */

export function ListSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-6">
      {[0, 1].map((group) => (
        <div key={group}>
          <div className="bg-muted mb-2 ml-1 h-3 w-20 animate-pulse rounded" />
          <div className="bg-card divide-border/70 divide-y rounded-xl border">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3">
                <div className="bg-muted size-9 shrink-0 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-3.5 w-2/5 animate-pulse rounded" />
                  <div className="bg-muted/70 h-3 w-1/4 animate-pulse rounded" />
                </div>
                <div className="bg-muted h-4 w-20 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyMonth({ monthLabel, onCreate }: { monthLabel: string; onCreate: () => void }) {
  return (
    <div className="border-border/70 flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-12 text-center">
      <div>
        <p className="font-medium">Nada lançado em {monthLabel}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          O primeiro lançamento já começa a montar o resumo do mês.
        </p>
      </div>
      <Button onClick={onCreate} size="lg">
        <Plus className="size-4" />
        Novo lançamento
      </Button>
    </div>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="border-border/70 flex flex-col items-center gap-4 rounded-xl border border-dashed px-5 py-12 text-center">
      <SearchX aria-hidden className="text-muted-foreground size-7" />
      <div>
        <p className="font-medium">Nenhum lançamento com esses filtros</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Existe movimento neste mês, mas nada que combine com a busca atual.
        </p>
      </div>
      <Button onClick={onClear} variant="outline">
        Limpar filtros
      </Button>
    </div>
  );
}

/**
 * Erro de leitura.
 *
 * Nao oferece "tentar de novo" como unica saida nem joga o stack na tela: diz
 * o que aconteceu, em portugues, e deixa a acao de recarregar explicita.
 */
export function ListError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-expense-surface flex flex-col items-center gap-4 rounded-xl px-5 py-10 text-center">
      <div>
        <p className="text-expense font-medium">Não foi possível carregar os lançamentos</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Seus dados continuam salvos. Nada foi alterado.
        </p>
      </div>
      <Button onClick={onRetry} variant="outline">
        Tentar de novo
      </Button>
    </div>
  );
}
