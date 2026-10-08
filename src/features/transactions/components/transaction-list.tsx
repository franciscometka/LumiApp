'use client';

import { ArrowDownLeft, ArrowUpRight, Clock, Repeat } from 'lucide-react';

import { MoneyText } from '@/components/finan/money-text';
import type { DayGroup } from '@/domain/calculations/grouping';
import type { Category } from '@/domain/entities/category';
import type { Transaction } from '@/domain/entities/transaction';
import { isIncome, statusLabel } from '@/domain/entities/transaction';
import type { ID } from '@/domain/shared/id';
import type { PlainDate } from '@/domain/shared/plain-date';
import { formatRelativeDay } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

/**
 * Extrato agrupado por dia.
 *
 * Nao e tabela. Nao ha cabecalho de coluna, nem borda de celula, nem acao
 * repetida em cada linha — o briefing pediu um app, e a lista de um app e uma
 * sequencia de linhas toca.veis com uma mao.
 *
 * Entrada e saida se distinguem por TRES pistas independentes: o sinal
 * tipografico (+/−), a seta, e a cor. Quem nao enxerga a diferenca entre o
 * verde e o vermelho le o sinal; quem usa leitor de tela ouve o rotulo.
 */
export function TransactionList({
  groups,
  today,
  categoriesById,
  onSelect,
  onToggleStatus,
  pendingStatusId,
}: {
  groups: readonly DayGroup[];
  today: PlainDate;
  categoriesById: ReadonlyMap<ID, Category>;
  onSelect: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  /** Id cuja alternancia de status esta em voo, para travar o botao. */
  pendingStatusId: ID | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.date}>
          <header className="flex items-baseline justify-between gap-3 px-1 pb-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase first-letter:uppercase">
              {formatRelativeDay(group.date, today)}
            </h3>
            {/*
              Saldo do dia so aparece quando ha os dois lados: num dia de
              gastos apenas, repetir a soma logo abaixo das parcelas nao
              informa nada novo.
            */}
            {group.incomeCents > 0 && group.expenseCents > 0 ? (
              <MoneyText value={group.netCents} size="sm" tone="signed" showSign />
            ) : null}
          </header>

          <ul className="bg-card divide-border/70 divide-y overflow-hidden rounded-xl border">
            {group.transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categoryName={categoriesById.get(transaction.categoryId)?.name ?? null}
                onSelect={onSelect}
                onToggleStatus={onToggleStatus}
                isTogglingStatus={pendingStatusId === transaction.id}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TransactionRow({
  transaction,
  categoryName,
  onSelect,
  onToggleStatus,
  isTogglingStatus,
}: {
  transaction: Transaction;
  categoryName: string | null;
  onSelect: (transaction: Transaction) => void;
  onToggleStatus: (transaction: Transaction) => void;
  isTogglingStatus: boolean;
}) {
  const income = isIncome(transaction);
  const isPending = transaction.status === 'pending';
  const Icon = income ? ArrowDownLeft : ArrowUpRight;

  return (
    <li className="flex items-stretch">
      {/*
        A linha inteira abre a edicao. Alvo grande, uma mao, sem precisar
        acertar um icone de 16px.
      */}
      <button
        type="button"
        onClick={() => {
          onSelect(transaction);
        }}
        className="hover:bg-accent/60 flex min-h-[4.25rem] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <span
          aria-hidden
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            income ? 'bg-income-surface text-income' : 'bg-expense-surface text-expense',
          )}
        >
          <Icon className="size-4" strokeWidth={2.4} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">
            {transaction.description}
          </span>
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-[13px]">
            {/*
              Marca de origem recorrente. Um icone de 12px, nao um selo: a
              informacao importa quando a pessoa se pergunta "de onde veio
              isso?", e nao merece competir com a descricao.
            */}
            {transaction.recurringBillId === undefined ? null : (
              <Repeat aria-label="Lançamento recorrente" className="size-3 shrink-0" />
            )}
            <span className="truncate">{categoryName ?? 'Sem categoria'}</span>
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="flex items-baseline gap-0.5">
            {/*
              O valor e sempre positivo no dominio; o sinal vem do tipo. Aqui
              ele e desenhado a parte, porque e a pista que sobrevive a
              ausencia de cor — e o leitor de tela recebe a palavra inteira em
              vez de um "mais" solto.
            */}
            <span className="sr-only">{income ? 'Entrada de' : 'Saída de'}</span>
            <span
              aria-hidden
              className={cn(
                'text-[15px] font-semibold',
                income ? 'text-income' : 'text-expense',
              )}
            >
              {income ? '+' : '−'}
            </span>
            <MoneyText
              value={transaction.amountCents}
              size="sm"
              tone={income ? 'income' : 'expense'}
            />
          </span>
          {/*
            Status so quando ele muda a leitura. "Pago" em tudo que esta pago
            seria um selo em 90% das linhas, que e o mesmo que nenhum selo.
          */}
          {isPending ? (
            <span className="text-muted-foreground flex items-center gap-1 text-[11px] font-medium">
              <Clock className="size-3" />
              {statusLabel(transaction.type, transaction.status)}
            </span>
          ) : null}
        </span>
      </button>

      {/*
        Dar baixa sem abrir o formulario: e a acao que mais se repete no mes,
        e obriga-la a passar pela sheet seria atrito puro.
      */}
      {isPending ? (
        <button
          type="button"
          onClick={() => {
            onToggleStatus(transaction);
          }}
          disabled={isTogglingStatus}
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-foreground border-border/70 w-14 shrink-0 border-l text-[11px] font-semibold transition-colors',
            isTogglingStatus && 'opacity-50',
          )}
        >
          {isTogglingStatus ? '···' : income ? 'Recebi' : 'Paguei'}
        </button>
      ) : null}
    </li>
  );
}
