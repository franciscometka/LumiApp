import type { Route } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { MoneyText } from '@/components/finan/money-text';
import type { HistoryMonth, HistoryPlanStatus } from '@/domain/calculations/history';
import type { Money } from '@/domain/shared/money';
import { formatMonthKey } from '@/domain/shared/plain-date';
import { cn } from '@/lib/utils';

/**
 * Um mes por linha, do mais recente ao mais antigo — a ordem de um extrato.
 *
 * Tocar abre o Dashboard daquele mes (`/?month=`). Nao ha tela de detalhe
 * propria: o Dashboard ja e o detalhe de um mes, e uma segunda versao dele
 * acabaria discordando da primeira.
 */
export function MonthList({ months }: { months: readonly HistoryMonth[] }) {
  const newestFirst = [...months].reverse();

  return (
    <section className="bg-card overflow-hidden rounded-xl border">
      <h2 className="text-muted-foreground border-b px-5 py-3 text-xs font-medium tracking-wide uppercase">
        Meses
      </h2>
      <ul className="divide-y">
        {newestFirst.map((month) => (
          <li key={month.month}>
            <MonthRow month={month} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MonthRow({ month }: { month: HistoryMonth }) {
  const isCurrent = month.temporality === 'current';

  return (
    <Link
      href={`/?month=${month.month}` as Route}
      className="hover:bg-accent/60 flex items-center gap-3 px-5 py-3.5 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium first-letter:uppercase">
            {formatMonthKey(month.month)}
          </span>
          {isCurrent ? <Tag tone="accent">Em andamento</Tag> : null}
          {month.dataState === 'generated_only' ? <Tag>Só recorrentes pendentes</Tag> : null}
        </div>

        {month.dataState === 'empty' ? (
          <p className="text-muted-foreground mt-1 text-[13px]">
            Sem lançamentos
            {/* "Dentro do limite" sem gasto nenhum seria verdade vazia: o plano
                aparece so como contexto. */}
            {month.planStatus === 'none' ? null : ' · Havia planejamento'}
          </p>
        ) : (
          <>
            {/* Duas colunas no celular, tres a partir de `sm`. Em 375px tres
                colunas cortavam o resultado ("+ R$ 2.110,…"), e valor de
                dinheiro truncado nao e valor. */}
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <Metric label="Renda gerada" value={month.earnedIncome} />
              <Metric label="Gastos operacionais" value={month.operationalExpense} />
              <Metric label="Resultado" value={month.result} signed />
            </dl>
            <p className="text-muted-foreground mt-1.5 text-xs">
              {planStatusLabel(month.planStatus, isCurrent)}
              {month.dataState === 'generated_only' ? ' · fora das médias' : null}
            </p>
          </>
        )}
      </div>

      <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}

function Metric({
  label,
  value,
  signed = false,
}: {
  label: string;
  value: Money | null;
  signed?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="mt-0.5">
        {value === null ? (
          <span className="text-muted-foreground text-sm">—</span>
        ) : (
          <MoneyText
            value={value}
            size="sm"
            tone={signed ? 'signed' : 'inherit'}
            showSign={signed && value !== 0}
            className="block text-sm whitespace-nowrap"
          />
        )}
      </dd>
    </div>
  );
}

function Tag({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'accent' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'accent' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      {children}
    </span>
  );
}

/** Rotulo do plano. O mes atual ainda pode mudar: "ate agora". */
function planStatusLabel(status: HistoryPlanStatus, isCurrent: boolean): string {
  switch (status) {
    case 'none':
      return 'Sem planejamento';
    case 'no_limit':
      return 'Planejado, sem limite de gastos';
    case 'within_limit':
      return isCurrent ? 'Dentro do limite até agora' : 'Dentro do limite';
    case 'over_limit':
      return isCurrent ? 'Acima do limite' : 'Fechou acima do limite';
  }
}
