import Link from 'next/link';

import { MoneyText } from '@/components/finan/money-text';
import type { PendingSummary } from '@/domain/calculations/pending';
import type { Category } from '@/domain/entities/category';
import type { Transaction } from '@/domain/entities/transaction';
import type { ID } from '@/domain/shared/id';
import type { PlainDate } from '@/domain/shared/plain-date';
import { differenceInDays, formatPlainDate, isBefore } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

/** Quantas contas cabem na tela inicial antes de virar lista. */
const VISIBLE_LIMIT = 3;

/**
 * Contas a pagar.
 *
 * So informacao acionavel: nome, valor, quando vence e se ja venceu. Categoria,
 * forma de pagamento e observacoes nao mudam a decisao de pagar hoje — ficam
 * na tela de Transacoes.
 *
 * A ordem vem de `calculatePending`, que ja entrega da mais proxima para a mais
 * distante. Vencidas recebem destaque de cor, nao de alarme: quem esta com
 * conta atrasada ja sabe, e um banner vermelho so adiciona vergonha.
 */
export function PendingBills({
  pending,
  today,
  categoriesById,
}: {
  pending: PendingSummary;
  today: PlainDate;
  categoriesById: ReadonlyMap<ID, Category>;
}) {
  if (pending.count === 0) {
    return (
      <Section>
        <p className="text-muted-foreground px-5 pb-5 text-sm">Tudo pago por aqui.</p>
      </Section>
    );
  }

  const visible = pending.items.slice(0, VISIBLE_LIMIT);
  const remaining = pending.count - visible.length;

  return (
    <Section
      total={pending.totalCents}
      count={pending.count}
      overdueCount={pending.overdueCount}
    >
      <ul className="divide-y">
        {visible.map((transaction) => (
          <BillRow
            key={transaction.id}
            transaction={transaction}
            today={today}
            categoryName={categoriesById.get(transaction.categoryId)?.name ?? null}
          />
        ))}
      </ul>

      {remaining > 0 ? (
        <Link
          href="/transacoes"
          className="text-muted-foreground hover:text-foreground block border-t px-5 py-3 text-center text-sm transition-colors"
        >
          Ver {remaining === 1 ? 'mais 1 conta' : `mais ${remaining} contas`}
        </Link>
      ) : null}
    </Section>
  );
}

function Section({
  children,
  total,
  count,
  overdueCount = 0,
}: {
  children: React.ReactNode;
  total?: Parameters<typeof MoneyText>[0]['value'];
  count?: number;
  overdueCount?: number;
}) {
  return (
    <section className="bg-card rounded-xl border">
      <div className="flex items-baseline justify-between gap-3 px-5 py-4">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Contas a pagar
        </h2>
        {total === undefined ? null : (
          <div className="text-right">
            <MoneyText value={total} size="sm" />
            {overdueCount > 0 ? (
              <p className="text-expense text-[11px]">
                {overdueCount === 1 ? '1 vencida' : `${overdueCount} vencidas`}
              </p>
            ) : count === undefined ? null : (
              <p className="text-muted-foreground text-[11px]">
                {count === 1 ? '1 conta' : `${count} contas`}
              </p>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function BillRow({
  transaction,
  today,
  categoryName,
}: {
  transaction: Transaction;
  today: PlainDate;
  categoryName: string | null;
}) {
  const overdue = isBefore(transaction.date, today);

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{transaction.description}</p>
        <p className={cn('mt-0.5 text-xs', overdue ? 'text-expense' : 'text-muted-foreground')}>
          {dueLabel(transaction.date, today, overdue)}
          {categoryName === null ? null : (
            <span className="text-muted-foreground"> · {categoryName}</span>
          )}
        </p>
      </div>
      <MoneyText value={transaction.amountCents} size="sm" className="shrink-0" />
    </div>
  );
}

/**
 * Prazo em linguagem de pessoa.
 *
 * "Vence em 3 dias" responde a pergunta; "18/10/2026" obriga a calcular. A data
 * absoluta volta quando o prazo e longo o bastante para ela ser mais util.
 */
function dueLabel(date: PlainDate, today: PlainDate, overdue: boolean): string {
  const days = differenceInDays(today, date);

  if (overdue) {
    const late = Math.abs(days);
    return late === 1 ? 'Venceu ontem' : `Venceu há ${late} dias`;
  }

  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  if (days <= 7) return `Vence em ${days} dias`;
  return `Vence em ${formatPlainDate(date)}`;
}
