'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { HistoryMonth } from '@/domain/calculations/history';
import { formatMonthAbbrev } from '@/domain/shared/plain-date';

/**
 * Renda gerada e gastos operacionais, lado a lado, mes a mes.
 *
 * Duas series, uma escala. O resultado do mes NAO entra aqui: ele pode ser
 * negativo, e uma terceira serie com sinal obrigaria um eixo que cruza o zero
 * — o grafico viraria leitura de planilha. O resultado esta na lista logo
 * abaixo, com sinal e cor.
 *
 * Sem tooltip: no celular nao existe hover, e os valores exatos estao na lista.
 * O grafico mostra forma e proporcao; numero exato e trabalho da lista.
 *
 * Mes sem lancamento fica SEM barra (valor `null`), nao com barra de altura
 * zero: o rotulo do mes continua no eixo, e o buraco fica visivel como
 * buraco. Com um unico mes de dados, o grafico mostra um par de barras e o
 * resto vazio — que e exatamente a situacao.
 *
 * As cores sao as funcionais `income` e `expense`, ja validadas para os dois
 * temas. Os valores vao em centavos: o grafico so precisa de proporcao, e
 * converter para reais aqui seria fazer conta de dinheiro em componente.
 */
export function HistoryChart({ months }: { months: readonly HistoryMonth[] }) {
  const data = months.map((month) => ({
    month: month.month,
    label: formatMonthAbbrev(month.month),
    earnedIncome: month.earnedIncome,
    operationalExpense: month.operationalExpense,
  }));

  return (
    <section className="bg-card rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Mês a mês
        </h2>
        <ul className="text-muted-foreground flex gap-4 text-xs">
          <LegendItem colorClass="bg-income" label="Renda gerada" />
          <LegendItem colorClass="bg-expense" label="Gastos operacionais" />
        </ul>
      </div>

      <div
        className="mt-4 h-44"
        role="img"
        aria-label="Gráfico de barras com renda gerada e gastos operacionais por mês. Os valores estão na lista de meses."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            barCategoryGap="22%"
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              interval={0}
              tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
              height={22}
            />
            <YAxis hide domain={[0, 'auto']} />
            <Bar
              dataKey="earnedIncome"
              fill="var(--color-income)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="operationalExpense"
              fill="var(--color-expense)"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className={`size-2.5 rounded-sm ${colorClass}`} />
      {label}
    </li>
  );
}
