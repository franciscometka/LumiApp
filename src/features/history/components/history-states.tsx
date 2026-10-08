'use client';

import { Repeat, RotateCcw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Mesma geometria do conteudo real, para a pagina nao saltar. */
export function HistorySkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="bg-card h-32 animate-pulse rounded-xl border" />
      <div className="bg-card h-60 animate-pulse rounded-xl border" />
      <div className="bg-card h-72 animate-pulse rounded-xl border" />
    </div>
  );
}

export function HistoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-card rounded-2xl border px-5 py-10 text-center">
      <div className="bg-expense-surface text-expense mx-auto grid size-10 place-items-center rounded-lg">
        <TriangleAlert className="size-5" />
      </div>
      <h2 className="mt-4 text-base font-semibold tracking-tight">
        Não foi possível montar o histórico
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

/** Nenhum lancamento em nenhum mes da janela. */
export function HistoryEmpty({ size }: { size: number }) {
  return (
    <div className="bg-card rounded-2xl border px-5 py-12 text-center">
      <h2 className="text-lg font-semibold tracking-tight">Ainda não há histórico</h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
        Nenhum lançamento nos últimos {size} meses. Conforme você usa o app, seus meses aparecem
        aqui lado a lado.
      </p>
    </div>
  );
}

/**
 * Aviso de que abrir o Historico lancou recorrencias em meses que ninguem
 * tinha aberto. Uma linha, sem modal: nada deu errado, e so a explicacao de
 * por que meses antigos ganharam lancamentos.
 */
export function PreparedNotice({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <p
      role="status"
      className="text-muted-foreground bg-muted/50 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed"
    >
      <Repeat aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {count === 1
          ? '1 lançamento recorrente foi adicionado ao histórico.'
          : `${String(count)} lançamentos recorrentes foram adicionados ao histórico.`}
      </span>
    </p>
  );
}
