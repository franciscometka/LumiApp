'use client';

import { AlertTriangle, Pencil } from 'lucide-react';

import { MoneyText } from '@/components/finan/money-text';
import { Button } from '@/components/ui/button';
import type { CardOverview } from '@/domain/calculations/cards';
import type { Card } from '@/domain/entities/card';
import { clampPercentage, formatPercentage } from '@/domain/shared/percentage';
import { formatPlainDate } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

/**
 * Um cartao na lista.
 *
 * O numero grande e a FATURA — e o que a pessoa quer saber ao abrir a tela.
 * Limite e disponivel ficam em segundo plano porque sao contexto, nao a
 * pergunta.
 *
 * "Atualizada em" aparece sempre que existir: uma fatura de tres meses atras
 * exibida sem data passaria por atual, e a pessoa tomaria decisao sobre um
 * numero vencido. Quando nunca foi atualizada, o app diz isso.
 */
export function CardRow({
  overview,
  onEdit,
  onUpdateInvoice,
}: {
  overview: CardOverview;
  onEdit: (card: Card) => void;
  onUpdateInvoice: (card: Card) => void;
}) {
  const { card, usagePercentage, isOverLimit } = overview;
  const hasLimit = card.limitCents > 0;

  return (
    <li className="bg-card rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: `var(--color-${card.colorToken})` }}
          />
          <h3 className="truncate font-medium">{card.name}</h3>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit(card);
          }}
          aria-label={`Editar ${card.name}`}
          className="text-muted-foreground -mt-1 -mr-2 shrink-0"
        >
          <Pencil className="size-4" />
        </Button>
      </div>

      <div className="mt-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Fatura atual
        </p>
        <MoneyText value={overview.invoiceCents} size="lg" className="mt-0.5 block" />
        <p className="text-muted-foreground mt-1 text-xs">
          {card.invoiceUpdatedAt === undefined
            ? 'Ainda não atualizada'
            : `Atualizada em ${formatTimestamp(card.invoiceUpdatedAt)}`}
        </p>
      </div>

      {hasLimit ? (
        <div className="mt-4">
          {/*
            Rotulo e valor em lados opostos, cada um numa unica linha. Juntar
            "Disponivel R$ 1.235,00" e "38% de R$ 2.000,00" na mesma linha
            quebrava o valor no meio a 375px, separando o "R$" do numero.
          */}
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="text-muted-foreground">Disponível</span>
            <MoneyText value={overview.availableCents} size="sm" />
          </div>

          <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className={cn('h-full rounded-full', isOverLimit ? 'bg-expense' : 'bg-primary')}
              style={{ width: `${String(clampPercentage(usagePercentage ?? 0))}%` }}
            />
          </div>

          <p className="text-muted-foreground mt-2 text-xs tabular-nums">
            {formatPercentage(usagePercentage)} do limite de{' '}
            <MoneyText value={overview.limitCents} size="sm" className="text-muted-foreground text-xs font-medium" />
          </p>

          {isOverLimit ? (
            // Estourar o limite e um fato financeiro, nao um erro do sistema:
            // cor funcional de saida, nunca `destructive`.
            <p className="text-expense mt-2 flex items-center gap-1.5 text-xs font-medium">
              <AlertTriangle className="size-3.5" />
              A fatura passou do limite.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground mt-3 text-[13px]">Limite não cadastrado.</p>
      )}

      <dl className="text-muted-foreground mt-4 grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-3 text-[13px]">
        <div className="flex justify-between">
          <dt>Fecha</dt>
          <dd className="text-foreground tabular-nums">{formatPlainDate(overview.nextClosing)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Vence</dt>
          <dd className="text-foreground tabular-nums">{formatPlainDate(overview.nextDue)}</dd>
        </div>
      </dl>

      <Button
        variant="outline"
        className="mt-4 w-full"
        onClick={() => {
          onUpdateInvoice(card);
        }}
      >
        Atualizar fatura
      </Button>
    </li>
  );
}

/** "06/10/2026" a partir do timestamp ISO gravado pelo repositorio. */
function formatTimestamp(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}
