import type { ReactNode } from 'react';

import { MoneyText } from '@/components/finan/money-text';
import type { HistorySummary as Summary, RankedMonth } from '@/domain/calculations/history';
import { formatMonthKey } from '@/domain/shared/plain-date';

/**
 * Media e melhor/pior mes.
 *
 * Tudo sai pronto de `summarizeHistory`. Com menos de dois meses encerrados
 * com lancamentos, nao ha resumo: a media de um mes so e o proprio mes, e um
 * "melhor mes" sem concorrente nao diz nada — mostrar isso seria um ranking
 * enganoso com cara de informacao.
 */
export function HistorySummary({ summary }: { summary: Summary }) {
  if (!summary.isAvailable) {
    return (
      <section className="bg-card rounded-xl border p-5">
        <Heading />
        <p className="mt-3 text-sm font-medium">Continue usando o app para comparar seus meses.</p>
        <p className="text-muted-foreground mt-1 text-[13px] leading-relaxed">
          Médias e melhor/pior mês aparecem quando houver pelo menos dois meses encerrados com
          lançamentos.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-xl border p-5">
      <Heading />
      <p className="text-muted-foreground mt-1 text-xs">
        {summary.eligibleCount} meses encerrados com lançamentos
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
        <Stat label="Renda gerada média">
          <MoneyText value={summary.averageEarnedIncome} size="sm" />
        </Stat>
        <Stat label="Gastos operacionais médios">
          <MoneyText value={summary.averageOperationalExpense} size="sm" />
        </Stat>

        {summary.best === null || summary.worst === null ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground text-xs">Melhor e pior mês</dt>
            <dd className="mt-1 text-sm">Todos os meses tiveram o mesmo resultado.</dd>
          </div>
        ) : (
          <>
            <Ranked label="Melhor mês" entry={summary.best} />
            <Ranked label="Pior mês" entry={summary.worst} />
          </>
        )}
      </dl>
    </section>
  );
}

function Heading() {
  return (
    <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Resumo</h2>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Ranked({ label, entry }: { label: string; entry: RankedMonth }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">
        <span className="block text-sm font-medium first-letter:uppercase">
          {formatMonthKey(entry.month)}
        </span>
        <MoneyText value={entry.result} size="sm" tone="signed" showSign className="block" />
      </dd>
    </div>
  );
}
