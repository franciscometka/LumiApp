import { ArrowDownLeft, ArrowUpRight, Clock } from 'lucide-react';

import { MoneyText } from '@/components/finan/money-text';
import type { PeriodSnapshot } from '@/domain/calculations/snapshot';
import { formatMoney } from '@/domain/shared/money';
import { cn } from '@/lib/utils';

/**
 * Tres cartoes. Nao quatro, nao seis.
 *
 * Cada metrica extra aqui custa atencao e devolve pouco: comprometimento,
 * taxa de poupanca e projecao ja aparecem como insight, onde viram frase em
 * vez de mais um numero solto a interpretar.
 */
export function StatCards({ snapshot }: { snapshot: PeriodSnapshot }) {
  const { totals, pending } = snapshot;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <StatCard
        icon={ArrowDownLeft}
        label="Entradas"
        value={totals.income}
        tone="income"
        // Honestidade sobre a origem: quando parte do que entrou veio da
        // reserva, o cartao diz quanto foi renda de verdade. Sem isso, "R$
        // 3.100 de entradas" sugeriria que o mes gerou R$ 3.100.
        footnote={
          totals.transferIn > 0
            ? `${formatMoney(totals.earnedIncome)} de renda · ${formatMoney(totals.transferIn)} da reserva`
            : undefined
        }
      />

      <StatCard icon={ArrowUpRight} label="Gastos" value={totals.expense} tone="expense" />

      <StatCard
        icon={Clock}
        label="A pagar"
        value={pending.totalCents}
        tone={pending.overdueCount > 0 ? 'expense' : 'neutral'}
        className="col-span-2 lg:col-span-1"
        footnote={pendingFootnote(pending.count, pending.overdueCount)}
      />
    </div>
  );
}

function pendingFootnote(count: number, overdueCount: number): string {
  if (count === 0) return 'Nada em aberto';
  if (overdueCount > 0) {
    return `${count} ${count === 1 ? 'conta' : 'contas'} · ${overdueCount} ${
      overdueCount === 1 ? 'vencida' : 'vencidas'
    }`;
  }
  return `${count} ${count === 1 ? 'conta' : 'contas'}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  footnote,
  className,
}: {
  icon: typeof ArrowUpRight;
  label: string;
  value: Parameters<typeof MoneyText>[0]['value'];
  tone: 'income' | 'expense' | 'neutral';
  footnote?: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-card rounded-xl border px-4 py-3.5', className)}>
      <div className="text-muted-foreground flex items-center gap-1.5">
        <Icon
          className={cn(
            'size-3.5',
            tone === 'income' && 'text-income',
            tone === 'expense' && 'text-expense',
          )}
          strokeWidth={2.4}
        />
        <span className="text-xs font-medium">{label}</span>
      </div>

      <div className="mt-1.5">
        <MoneyText value={value} size="md" />
      </div>

      {footnote === undefined ? null : (
        <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{footnote}</p>
      )}
    </div>
  );
}
